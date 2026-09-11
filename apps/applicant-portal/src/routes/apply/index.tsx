import React, { useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
// This is the real, documented Atlaskit form API (atlassian.design/components/form).
// There is no `useSimpleForm` / `useSimpleField` hook pair in @atlaskit/design-system —
// that was an invented API. Form/Field/FormFooter use a render-props pattern instead.
import Form, { Field, FormFooter, ErrorMessage } from "@atlaskit/form";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { WizardLayout, AudioTooltip } from "@usrp/ui";

const STORAGE_KEY = "usrp_apply_draft";

interface WizardData {
  readonly agency?: string;
  readonly category?: string;
  readonly phone?: string;
  readonly emergencyContact?: string;
  readonly declaration?: boolean;
}

const STEP_LABELS = ["Agency", "Contact", "Education", "Declaration", "Review"] as const;

// --- Layout tweaks, expressed as design-token-backed styles instead of inline styles ---
// (matches the cssMap + token() convention used in officer-console/login.tsx)
const layoutStyles = cssMap({
  growField: { flexGrow: 1 },
  // Nudges the audio icon down so it lines up with the input, not the label above it.
  audioIconOffset: { paddingBlockStart: token("space.300") },
});

function loadDraft(): WizardData {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw !== null ? (JSON.parse(raw) as WizardData) : {};
  } catch {
    // sessionStorage can throw in private-browsing / storage-disabled contexts.
    return {};
  }
}

function saveDraft(data: WizardData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable — the wizard still works in-memory for this session.
  }
}

// Field's `error` render-prop arg is a validation *code* (e.g. "EMPTY" for a failed
// isRequired check), not display text — this turns it into a readable message.
function requiredFieldError(error: string | undefined): string | null {
  if (error === "EMPTY") return "This field is required.";
  if (error) return error;
  return null;
}

function StepAgency({
  data,
  onNext,
}: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Form<{ agency: string; category: string }> onSubmit={(values) => onNext(values)}>
      {({ formProps, submitting }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Field
              name="agency"
              label="Which agency are you applying to?"
              isRequired
              defaultValue={data.agency}
            >
              {({ fieldProps, error }) => (
                <>
                  <TextField {...fieldProps} />
                  {requiredFieldError(error) !== null && (
                    <ErrorMessage>{requiredFieldError(error)}</ErrorMessage>
                  )}
                </>
              )}
            </Field>

            <Field
              name="category"
              label="Recruitment category"
              isRequired
              defaultValue={data.category}
            >
              {({ fieldProps, error }) => (
                <>
                  <TextField {...fieldProps} />
                  {requiredFieldError(error) !== null && (
                    <ErrorMessage>{requiredFieldError(error)}</ErrorMessage>
                  )}
                </>
              )}
            </Field>

            <FormFooter>
              <LoadingButton type="submit" appearance="primary" isLoading={submitting}>
                {t("actions.next")}
              </LoadingButton>
            </FormFooter>
          </Stack>
        </form>
      )}
    </Form>
  );
}

function StepContact({
  data,
  onNext,
  onBack,
}: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Form<{ phone: string; emergencyContact: string }> onSubmit={(values) => onNext(values)}>
      {({ formProps, submitting }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Inline space="space.100" alignBlock="center">
              <Box xcss={layoutStyles.growField}>
                <Field
                  name="phone"
                  label="Your phone number"
                  isRequired
                  defaultValue={data.phone}
                >
                  {({ fieldProps, error }) => (
                    <>
                      <TextField
                        {...fieldProps}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      {requiredFieldError(error) !== null && (
                        <ErrorMessage>{requiredFieldError(error)}</ErrorMessage>
                      )}
                    </>
                  )}
                </Field>
              </Box>
              <Box xcss={layoutStyles.audioIconOffset}>
                <AudioTooltip
                  audioSrc="/audio/phone-guidance-rw.mp3"
                  label="Listen in Kinyarwanda"
                />
              </Box>
            </Inline>

            <Field
              name="emergencyContact"
              label="Emergency contact phone"
              defaultValue={data.emergencyContact}
            >
              {({ fieldProps }) => (
                <TextField {...fieldProps} type="tel" inputMode="tel" autoComplete="tel" />
              )}
            </Field>

            <FormFooter>
              <Inline space="space.200">
                <Button appearance="subtle" onClick={onBack}>
                  {t("actions.back")}
                </Button>
                <LoadingButton type="submit" appearance="primary" isLoading={submitting}>
                  {t("actions.next")}
                </LoadingButton>
              </Inline>
            </FormFooter>
          </Stack>
        </form>
      )}
    </Form>
  );
}

// No form fields here — just an acknowledgement — so this stays a plain component
// rather than wrapping it in <Form>.
function StepDeclaration({
  onNext,
  onBack,
}: {
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Stack space="space.400">
      <SectionMessage title="Declaration" headingLevel="h3">
        <Text>
          I declare that all information provided in this application is true and
          accurate. I understand that a false declaration may result in
          disqualification and possible legal action.
        </Text>
      </SectionMessage>
      <Inline space="space.100" alignBlock="center">
        <AudioTooltip audioSrc="/audio/declaration-rw.mp3" label="Listen in Kinyarwanda" />
        <Text size="small" color="color.text.subtle">
          Tap the speaker icon to hear this declaration read aloud in Kinyarwanda.
        </Text>
      </Inline>
      <Inline space="space.200">
        <Button appearance="subtle" onClick={onBack}>
          {t("actions.back")}
        </Button>
        <Button appearance="primary" onClick={() => onNext({ declaration: true })}>
          I agree
        </Button>
      </Inline>
    </Stack>
  );
}

export default function ApplyPage(): React.ReactElement {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(loadDraft);

  const advance = (patch: Partial<WizardData>): void => {
    const updated = { ...data, ...patch };
    setData(updated);
    saveDraft(updated);
    setStep((current) => current + 1);
  };

  const back = (): void => setStep((current) => Math.max(0, current - 1));

  return (
    <WizardLayout
      title={STEP_LABELS[step] ?? "Application"}
      currentStep={step}
      steps={STEP_LABELS}
      footer={null}
    >
      {step === 0 && <StepAgency data={data} onNext={advance} />}
      {step === 1 && <StepContact data={data} onNext={advance} onBack={back} />}
      {step === 2 && (
        <Stack space="space.400">
          <Text color="color.text.subtle">
            Education details are collected per agency. The document set differs
            between RDF, RNP and RCS, so this step is filled in once the agency
            document requirements are wired to the contract.
          </Text>
          <Inline space="space.200">
            <Button appearance="subtle" onClick={back}>
              {t("actions.back")}
            </Button>
            <Button appearance="primary" onClick={() => advance({})}>
              {t("actions.next")}
            </Button>
          </Inline>
        </Stack>
      )}
      {step === 3 && <StepDeclaration onNext={advance} onBack={back} />}
      {step === 4 && (
        <Stack space="space.400">
          <SectionMessage title="Review your draft" headingLevel="h3">
            <Stack space="space.100">
              <Text>Agency: {data.agency ?? "-"}</Text>
              <Text>Category: {data.category ?? "-"}</Text>
              <Text>Phone: {data.phone ?? "-"}</Text>
              <Text>Declaration accepted: {data.declaration === true ? "yes" : "no"}</Text>
            </Stack>
          </SectionMessage>
          <SectionMessage appearance="warning" title="Filing is not yet available" headingLevel="h3">
            <Text>
              Your draft is saved on this device. Applications cannot yet be filed
              from this portal: the submission endpoint is not reachable from a
              browser, and no application is created until it is. Nothing you have
              entered has been sent to any agency. To apply now, attend a walk-in
              recruitment centre.
            </Text>
          </SectionMessage>
          <Inline space="space.200">
            <Button appearance="subtle" onClick={back}>
              {t("actions.back")}
            </Button>
            <Button appearance="default" href="/status">
              {t("nav.applications")}
            </Button>
          </Inline>
        </Stack>
      )}
    </WizardLayout>
  );
}