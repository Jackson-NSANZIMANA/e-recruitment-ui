import React, { useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import TextField from "@atlaskit/textfield";
import Form, { Field, FormFooter } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useRegisterWalkIn, useVerifyIdentity } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const pageStyles = cssMap({ base: { maxWidth: "600px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") }, successSpacing: { marginTop: token("space.300") } });
interface WalkInFormValues { readonly nationalId: string; readonly category: string; }

export default function WalkInPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const verifyMutation = useVerifyIdentity(client);
  const registerMutation = useRegisterWalkIn(client, agency);
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const handleSubmit = async (values: WalkInFormValues): Promise<void> => {
    const identity = await verifyMutation.mutateAsync({ nationalId: values.nationalId, channel: "WALK_IN" });
    const registered = await registerMutation.mutateAsync({ applicantId: identity.applicantId, category: values.category });
    setRegisteredId(registered.applicationId);
    if (navigator.vibrate !== undefined) navigator.vibrate([100, 50, 100]);
  };

  if (registeredId !== null) return <Box xcss={pageStyles.base}><SectionMessage appearance="success" title="Walk-in registered">Application {registeredId} has been added to the queue.</SectionMessage><Box xcss={pageStyles.successSpacing}><Button appearance="primary" onClick={() => { setRegisteredId(null); verifyMutation.reset(); registerMutation.reset(); }}>Next candidate</Button></Box></Box>;

  const isPending = verifyMutation.isPending || registerMutation.isPending;
  return <Box xcss={pageStyles.base}><Stack space="space.400"><Heading size="large" as="h1">{t("nav.walk_in")}</Heading>{(verifyMutation.isError || registerMutation.isError) && <SectionMessage appearance="error">{t("errors.generic")}</SectionMessage>}
    <Form<WalkInFormValues> onSubmit={handleSubmit}>{({ formProps, submitting }) => <form {...formProps}><Stack space="space.400">
      <Field name="nationalId" label="National ID number" isRequired>{({ fieldProps }) => <TextField {...fieldProps} placeholder="16-digit NID" maxLength={16} autoFocus />}</Field>
      <Field name="category" label="Recruitment category" isRequired>{({ fieldProps }) => <TextField {...fieldProps} placeholder="Category" />}</Field>
      <FormFooter><Inline space="space.200"><LoadingButton type="submit" appearance="primary" isLoading={submitting || isPending} isDisabled={session === null}>Register walk-in</LoadingButton><Button href="/dashboard" appearance="subtle">{t("actions.cancel")}</Button></Inline></FormFooter>
    </Stack></form>}</Form>
  </Stack></Box>;
}
