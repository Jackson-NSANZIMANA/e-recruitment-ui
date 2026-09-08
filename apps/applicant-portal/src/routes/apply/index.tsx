import React, { useState } from "react";
import { Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import TextField from "@atlaskit/textfield";
import Form, { Field, FormFooter } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import { useTranslation } from "@usrp/i18n";
import { WizardLayout, AudioTooltip } from "@usrp/ui";

/**
 * The application wizard.
 *
 * It collects and it saves a draft. It does NOT file an application, because no
 * citizen-reachable operation to file one exists: POST /v1/applications is
 * service-internal and the edge refuses to broker it (see the commit message).
 * The review step says so rather than offering a button that cannot work.
 */

const STORAGE_KEY = "usrp_apply_draft";

/**
 * The draft deliberately holds NO National ID, no OTP and no session value. A
 * revocable credential written to browser storage is a credential that has
 * already been copied, and the repo's security scan fails a storage write
 * carrying one.
 */
interface WizardData {
  readonly agency?: string;
  readonly category?: string;
  readonly phone?: string;
  readonly emergencyContact?: string;
  readonly declaration?: boolean;
}

/** One source for the step labels, so the tracker cannot drift from the titles. */
const STEP_LABELS = ["Agency", "Contact", "Education", "Declaration", "Review"] as const;

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
    // Storage unavailable - the draft stays in component state.
  }
}

function StepAgency({ data, onNext }: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Form<{ agency: string; category: string }> onSubmit={(values) => onNext(values)}>
      {({ formProps }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Field
              name="agency"
              label="Which agency are you applying to?"
              isRequired
              {...(data.agency !== undefined ? { defaultValue: data.agency } : {})}
            >
              {({ fieldProps }) => <TextField {...fieldProps} placeholder="RDF / RNP / RCS" />}
            </Field>
            <Field
              name="category"
              label="Recruitment category"
              isRequired
              {...(data.category !== undefined ? { defaultValue: data.category } : {})}
            >
              {({ fieldProps }) => <TextField {...fieldProps} />}
            </Field>
            <FormFooter>
              <Button type="submit" appearance="primary">{t("actions.next")}</Button>
            </FormFooter>
          </Stack>
        </form>
      )}
    </Form>
  );
}

function StepContact({ data, onNext, onBack }: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Form<{ phone: string; emergencyContact: string }> onSubmit={(values) => onNext(values)}>
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
                  <TextField {...fieldProps} type="tel" inputMode="tel" placeholder="+250 7XX XXX XXX" />
                )}
              </Field>
              <AudioTooltip audioSrc="/audio/phone-guidance-rw.mp3" label="Listen in Kinyarwanda" />
            </Inline>
            <Field
              name="emergencyContact"
              label="Emergency contact phone"
              {...(data.emergencyContact !== undefined ? { defaultValue: data.emergencyContact } : {})}
            >
              {({ fieldProps }) => (
                <TextField {...fieldProps} type="tel" inputMode="tel" placeholder="+250 7XX XXX XXX" />
              )}
            </Field>
            <FormFooter>
              <Inline space="space.200">
                <Button appearance="subtle" onClick={onBack}>{t("actions.back")}</Button>
                <Button type="submit" appearance="primary">{t("actions.next")}</Button>
              </Inline>
            </FormFooter>
          </Stack>
        </form>
      )}
    </Form>
  );
}

function StepDeclaration({ onNext, onBack }: {
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Stack space="space.400">
      <SectionMessage title="Declaration">
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
        <Button appearance="subtle" onClick={onBack}>{t("actions.back")}</Button>
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
            <Button appearance="subtle" onClick={back}>{t("actions.back")}</Button>
            <Button appearance="primary" onClick={() => advance({})}>{t("actions.next")}</Button>
          </Inline>
        </Stack>
      )}
      {step === 3 && <StepDeclaration onNext={advance} onBack={back} />}
      {step === 4 && (
        <Stack space="space.400">
          <SectionMessage title="Review your draft">
            <Stack space="space.100">
              <Text>Agency: {data.agency ?? "-"}</Text>
              <Text>Category: {data.category ?? "-"}</Text>
              <Text>Phone: {data.phone ?? "-"}</Text>
              <Text>Declaration accepted: {data.declaration === true ? "yes" : "no"}</Text>
            </Stack>
          </SectionMessage>

          {/*
            NO SUBMIT BUTTON, deliberately. There is no citizen-reachable
            operation that files an application, so a button here could only
            fail or lie. A disabled button with a tooltip is still a promise.
          */}
          <SectionMessage appearance="warning" title="Filing is not yet available">
            <Text>
              Your draft is saved on this device. Applications cannot yet be filed
              from this portal: the submission endpoint is not reachable from a
              browser, and no application is created until it is. Nothing you have
              entered has been sent to any agency. To apply now, attend a walk-in
              recruitment centre.
            </Text>
          </SectionMessage>

          <Inline space="space.200">
            <Button appearance="subtle" onClick={back}>{t("actions.back")}</Button>
            <Button appearance="default" href="/status">{t("nav.applications")}</Button>
          </Inline>
        </Stack>
      )}
    </WizardLayout>
  );
}
