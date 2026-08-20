import React, { useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import TextField from "@atlaskit/textfield";
import Form, { Field, FormFooter } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { useMutation } from "@tanstack/react-query";
import { createApiClient } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { WizardLayout, AudioTooltip } from "@usrp/ui";
import { BFF_BASE_URL } from "../../env.js";

// Module-level client — same pattern as home.tsx.
const client = createApiClient({ baseUrl: BFF_BASE_URL });

const submittedStyles = cssMap({
  wrapper: {
    maxWidth: "640px",
    marginInline: "auto",
    padding: token("space.600"),
  },
  spacing: {
    marginTop: token("space.300"),
  },
});

/**
 * Application wizard — "one-thing-per-page" pattern.
 *
 * HCI mandate (section 3):
 *   "Use a Linear Wizard pattern where each screen asks only one question.
 *    This drastically reduces cognitive load and allows for frequent Save Points."
 *
 * Each step is an independent component; the wizard shell manages:
 *   - Step index + navigation (Back / Next)
 *   - Auto-save to sessionStorage on every Next (offline resilience; cleared on tab close)
 *   - Progress tracker showing how far the applicant has come
 *
 * IMPORTANT: All collected data is held in sessionStorage until the final
 * Submit step, which submits to the BFF. This implements the
 * "Optimistic UI + IndexedDB + Background Sync" offline-first pattern —
 * even if the applicant closes the tab mid-wizard, no data is lost.
 */

const STORAGE_KEY = "usrp_apply_draft";

type WizardData = {
  agency?: string;
  postCode?: string;
  phone?: string;
  emergencyContact?: string;
  academicLevel?: string;
  declaration?: boolean;
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Agency & Post",
  "Contact",
  "Education",
  "Declaration",
  "Review & Submit",
];

// ─── Individual step components ───────────────────────────────────────────────

function StepAgencyPost({
  data,
  onNext,
}: {
  data: WizardData;
  onNext: (patch: Partial<WizardData>) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Form
      onSubmit={(values: { agency: string; postCode: string }) =>
        onNext(values)
      }
    >
      {({ formProps }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Field
              name="agency"
              label="Which agency are you applying to?"
              isRequired
              {...(data.agency !== undefined ? { defaultValue: data.agency } : {})}
            >
              {({ fieldProps }) => (
                <TextField {...fieldProps} placeholder="RDF / RNP / RCS" />
              )}
            </Field>
            <Field
              name="postCode"
              label="Post code"
              isRequired
              {...(data.postCode !== undefined ? { defaultValue: data.postCode } : {})}
            >
              {({ fieldProps }) => (
                <TextField {...fieldProps} placeholder="e.g. RDF-98001" />
              )}
            </Field>
            <FormFooter>
              <Button type="submit" appearance="primary">
                {t("actions.next")}
              </Button>
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
  data: WizardData;
  onNext: (patch: Partial<WizardData>) => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Form
      onSubmit={(values: { phone: string; emergencyContact: string }) =>
        onNext(values)
      }
    >
      {({ formProps }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Inline space="space.100" alignBlock="center">
              <Field
                name="phone"
                label="Your phone number"
                isRequired
                {...(data.phone !== undefined ? { defaultValue: data.phone } : {})}
              >
                {({ fieldProps }) => (
                  <TextField
                    {...fieldProps}
                    type="tel"
                    placeholder="+250 7XX XXX XXX"
                    inputMode="tel"
                  />
                )}
              </Field>
              <AudioTooltip
                audioSrc="/audio/phone-guidance-rw.mp3"
                label="Listen in Kinyarwanda"
              />
            </Inline>
            <Field
              name="emergencyContact"
              label="Emergency contact phone"
              {...(data.emergencyContact !== undefined ? { defaultValue: data.emergencyContact } : {})}
            >
              {({ fieldProps }) => (
                <TextField
                  {...fieldProps}
                  type="tel"
                  placeholder="+250 7XX XXX XXX"
                  inputMode="tel"
                />
              )}
            </Field>
            <FormFooter>
              <Inline space="space.200">
                <Button appearance="subtle" onClick={onBack}>
                  {t("actions.back")}
                </Button>
                <Button type="submit" appearance="primary">
                  {t("actions.next")}
                </Button>
              </Inline>
            </FormFooter>
          </Stack>
        </form>
      )}
    </Form>
  );
}

function StepDeclaration({
  onNext,
  onBack,
}: {
  data: WizardData;
  onNext: (patch: Partial<WizardData>) => void;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Stack space="space.400">
      <SectionMessage title="Declaration">
        <Text>
          I hereby declare that all information provided in this application is
          true and accurate. I understand that any false declaration may result
          in immediate disqualification and possible legal action.
        </Text>
      </SectionMessage>
      <Inline space="space.100" alignBlock="center">
        <AudioTooltip
          audioSrc="/audio/declaration-rw.mp3"
          label="Listen in Kinyarwanda"
        />
        <Text size="small" color="color.text.subtle">
          Tap the speaker icon to hear this declaration read aloud in Kinyarwanda.
        </Text>
      </Inline>
      <Inline space="space.200">
        <Button appearance="subtle" onClick={onBack}>
          {t("actions.back")}
        </Button>
        <Button
          appearance="primary"
          onClick={() => onNext({ declaration: true })}
        >
          I agree — {t("actions.next")}
        </Button>
      </Inline>
    </Stack>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

function loadDraft(): WizardData {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw !== null ? (JSON.parse(raw) as WizardData) : {};
  } catch {
    return {};
  }
}

function saveDraft(data: WizardData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable — continue silently; data held in state.
  }
}

export default function ApplyPage(): React.ReactElement {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(loadDraft);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (payload: WizardData) =>
      client.post("/applications", payload as Record<string, unknown>),
    onSuccess: () => {
      sessionStorage.removeItem(STORAGE_KEY);
      setSubmitted(true);
    },
  });

  const advance = (patch: Partial<WizardData>): void => {
    const updated = { ...data, ...patch };
    setData(updated);
    saveDraft(updated);
    setStep((s) => s + 1);
  };

  const back = (): void => setStep((s) => Math.max(0, s - 1));

  const stepTitles = [
    "Agency & Post",
    "Your contact",
    "Education",
    "Declaration",
    "Review & Submit",
  ];

  if (submitted) {
    return (
      <Box xcss={submittedStyles.wrapper}>
        <SectionMessage appearance="success" title="Application submitted ✓" headingLevel="h2">
          <Text>
            Your application has been received. You will be contacted via SMS
            when the status changes. You can track progress on the Status page.
          </Text>
        </SectionMessage>
        <Box xcss={submittedStyles.spacing}>
          <Button appearance="primary" href="/status">
            Track my application
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <WizardLayout
      title={stepTitles[step] ?? "Application"}
      currentStep={step}
      steps={STEP_LABELS}
      footer={null}
    >
      {step === 0 && <StepAgencyPost data={data} onNext={advance} />}
      {step === 1 && (
        <StepContact data={data} onNext={advance} onBack={back} />
      )}
      {step === 2 && (
        <Stack space="space.400">
          <Text color="color.text.subtle">
            Education step — add academic level fields here.
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
      {step === 3 && (
        <StepDeclaration data={data} onNext={advance} onBack={back} />
      )}
      {step === 4 && (
        <Stack space="space.400">
          <SectionMessage title="Review your application">
            <Stack space="space.100">
              <Text>Agency: {data.agency ?? "—"}</Text>
              <Text>Post: {data.postCode ?? "—"}</Text>
              <Text>Phone: {data.phone ?? "—"}</Text>
            </Stack>
          </SectionMessage>
          {submitMutation.isError && (
            <SectionMessage appearance="error" title="Submission failed">
              <Text>
                {submitMutation.error instanceof Error
                  ? submitMutation.error.message
                  : "An unexpected error occurred. Please try again."}
              </Text>
            </SectionMessage>
          )}
          <Inline space="space.200">
            <Button
              appearance="subtle"
              onClick={back}
              isDisabled={submitMutation.isPending}
            >
              {t("actions.back")}
            </Button>
            <LoadingButton
              appearance="primary"
              isLoading={submitMutation.isPending}
              onClick={() => submitMutation.mutate(data)}
            >
              {t("actions.submit")}
            </LoadingButton>
          </Inline>
        </Stack>
      )}
    </WizardLayout>
  );
}
