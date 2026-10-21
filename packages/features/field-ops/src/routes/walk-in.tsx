import React, { useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
// LinkButton, not the legacy Button: it renders through AppProvider's
// routerLinkComponent, so an in-app href is a client-side navigation (no full
// reload that would drop station state or re-probe the session offline).
import LinkButton from "@atlaskit/button/link";
import LoadingButton from "@atlaskit/button/loading-button";
import TextField from "@atlaskit/textfield";
import Select from "@atlaskit/select";
import Form, { Field, FormFooter } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import type { ApplicationCategory } from "@usrp/contracts";
import { ApiError, useRegisterWalkIn, useVerifyIdentity, useVetWalkIn, type ApiClient } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { academicInput, academicPathOf, walkInCategories, walkInRefusal } from "../model/walk-in.ts";

const pageStyles = cssMap({ base: { maxWidth: "600px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") }, spacing: { marginTop: token("space.300") } });
interface WalkInFormValues { readonly nationalId: string; readonly category: ApplicationCategory; readonly academicReference: string; }
interface Registered { readonly applicationId: string; readonly processingCode: string; readonly qrInvitationCode: string; }

// field-ops — RDF walk-in desk (ADR-012). Moved from apps/officer-console/src/routes/walk-in.tsx
// in S02 (ADR-FE-007); the host app injects the edge client.
export interface WalkInPageProps {
  readonly client: ApiClient;
}

export default function WalkInPage({ client }: WalkInPageProps): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const categories = walkInCategories(agency);
  const verifyMutation = useVerifyIdentity(client);
  const registerMutation = useRegisterWalkIn(client, agency);
  const vetMutation = useVetWalkIn(client, agency);
  const [category, setCategory] = useState<ApplicationCategory | null>(null);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [agePending, setAgePending] = useState(false);
  const [vetted, setVetted] = useState(false);
  const registry = category === null ? null : academicPathOf(category);
  // A refusal the officer can act on is named; only infrastructure faults stay generic.
  const refusal = registry === null ? null : walkInRefusal(registerMutation.error, registry);

  const handleSubmit = async (values: WalkInFormValues): Promise<void> => {
    verifyMutation.reset();
    registerMutation.reset();
    const identity = await verifyMutation.mutateAsync({ nationalId: values.nationalId.trim(), channel: "WALK_IN" });
    const created = await registerMutation.mutateAsync({
      applicantId: identity.applicantId,
      category: values.category,
      ...academicInput(values.category, values.academicReference),
    });
    setRegistered({ applicationId: created.applicationId, processingCode: created.processingCode, qrInvitationCode: created.qrInvitationCode });
    if (navigator.vibrate !== undefined) navigator.vibrate([100, 50, 100]);
  };
  const handleVet = async (applicationId: string): Promise<void> => { setAgePending(false); try { await vetMutation.mutateAsync({ applicationId }); setVetted(true); } catch (error) { if (error instanceof ApiError && error.normalised.kind === "conflict" && error.normalised.outcome === "AGE_PENDING") { setAgePending(true); return; } throw error; } };
  const reset = (): void => { setRegistered(null); setAgePending(false); setVetted(false); setCategory(null); verifyMutation.reset(); registerMutation.reset(); vetMutation.reset(); };

  if (registered !== null) return <Box xcss={pageStyles.base}><Stack space="space.400"><SectionMessage appearance="success" title="Walk-in registered" headingLevel="h3"><Stack space="space.100"><Text>{t("application.id")}: {registered.processingCode}</Text><Text>Invitation code: {registered.qrInvitationCode}</Text></Stack></SectionMessage>{agePending && <SectionMessage appearance="warning" title="Age verification still in progress" headingLevel="h3"><Text>The age check has not landed yet. This is normal and usually clears within seconds. Try the vetting step again.</Text></SectionMessage>}{vetMutation.isError && !agePending && <SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">{t("errors.generic")}</SectionMessage>}{vetted && <SectionMessage appearance="success" title="On-site vetting recorded" headingLevel="h3"><Text>The application has moved into on-site vetting. The candidate keeps the invitation code above for the physical test.</Text></SectionMessage>}<Box xcss={pageStyles.spacing}><Inline space="space.200">{!vetted && <LoadingButton appearance="primary" isLoading={vetMutation.isPending} onClick={() => { void handleVet(registered.applicationId); }}>{agePending ? "Retry vetting" : "Record on-site vetting"}</LoadingButton>}<Button appearance={vetted ? "primary" : "subtle"} onClick={reset}>Next candidate</Button></Inline></Box></Stack></Box>;

  const isPending = verifyMutation.isPending || registerMutation.isPending;
  const genericFailure = verifyMutation.isError || (registerMutation.isError && refusal === null);
  const options = categories.map((value) => ({ label: t(`apply.categories.${value}`), value }));
  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <Heading size="large" as="h1">{t("nav.walk_in")}</Heading>
        {refusal !== null && (
          <SectionMessage appearance="warning" title={t("walk_in.refusal_title")} headingLevel="h3">
            <Text>{t(refusal.key, refusal.values)}</Text>
          </SectionMessage>
        )}
        {genericFailure && <SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">{t("errors.generic")}</SectionMessage>}
        <Text size="small" color="color.text.subtle">Confirm the candidate&apos;s identity document in person. The registry returns no name or date of birth to check against.</Text>
        <Form<WalkInFormValues> onSubmit={handleSubmit}>
          {({ formProps, submitting }) => (
            <form {...formProps}>
              <Stack space="space.400">
                <Field name="nationalId" label="National ID number" isRequired defaultValue="">
                  {({ fieldProps }) => <TextField {...fieldProps} inputMode="numeric" maxLength={16} autoComplete="off" autoFocus />}
                </Field>
                <Field<ApplicationCategory>
                  name="category"
                  label={t("apply.category_label")}
                  isRequired
                  helperMessage={t("walk_in.category_help")}
                  component={({ fieldProps }) => (
                    <Select
                      inputId={fieldProps.id}
                      name={fieldProps.name}
                      options={options}
                      value={options.find((option) => option.value === fieldProps.value) ?? null}
                      isClearable={false}
                      isInvalid={fieldProps.isInvalid}
                      aria-labelledby={fieldProps["aria-labelledby"]}
                      onChange={(option) => {
                        if (option === null || option === undefined) return;
                        fieldProps.onChange(option.value);
                        setCategory(option.value);
                        registerMutation.reset();
                      }}
                      onBlur={fieldProps.onBlur}
                      onFocus={fieldProps.onFocus}
                    />
                  )}
                />
                {registry !== null && (
                  <Field
                    name="academicReference"
                    defaultValue=""
                    label={t(registry === "NESA" ? "apply.nesa_label" : "apply.hec_label")}
                    isRequired
                    helperMessage={t("walk_in.academic_help", { registry })}
                    component={({ fieldProps }) => <TextField {...fieldProps} autoComplete="off" />}
                  />
                )}
                <FormFooter>
                  <Inline space="space.200">
                    <LoadingButton type="submit" appearance="primary" isLoading={submitting || isPending} isDisabled={session === null || registry === null}>Register walk-in</LoadingButton>
                    <LinkButton href="/stations" appearance="subtle">{t("actions.cancel")}</LinkButton>
                  </Inline>
                </FormFooter>
              </Stack>
            </form>
          )}
        </Form>
      </Stack>
    </Box>
  );
}
