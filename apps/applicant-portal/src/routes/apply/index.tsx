import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import TextField from "@atlaskit/textfield";
import Select from "@atlaskit/select";
import Form, { Field, FormFooter } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import { APPLICATION_CATEGORIES, ACADEMIC_PATH_BY_CATEGORY, CATEGORY_AGENCY, type ApplicationCategory } from "@usrp/contracts";
import { ApiError, createApiClient, useSubmitMyApplication, type NormalisedError } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { WizardLayout, AudioTooltip } from "@usrp/ui";
import { EDGE_BASE_URL } from "../../env.js";

const STORAGE_KEY = "usrp_apply_draft";
const client = createApiClient({ baseUrl: EDGE_BASE_URL });

type AcademicPath = "NESA" | "HEC";

interface WizardData {
  /** The only required business input accepted by the edge. */
  readonly category?: ApplicationCategory;
  /** Exactly one of these is required by the backend's category rule. */
  readonly nesaIndexNumber?: string;
  readonly hecRegistrationNumber?: string;
  /** Local acknowledgement; deliberately not part of the edge request body. */
  readonly declaration?: boolean;
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error("This browser cannot create the UUID required for a filing attempt.");
}

function categoryOrUndefined(value: unknown): ApplicationCategory | undefined {
  return typeof value === "string" && (APPLICATION_CATEGORIES as readonly string[]).includes(value)
    ? value as ApplicationCategory
    : undefined;
}

function loadDraft(): WizardData {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed === null || typeof parsed !== "object") return {};
    const raw = parsed as Record<string, unknown>;
    const draft: { category?: ApplicationCategory; nesaIndexNumber?: string; hecRegistrationNumber?: string; declaration?: boolean } = {};
    const category = categoryOrUndefined(raw["category"]);
    const nesaIndexNumber = raw["nesaIndexNumber"];
    const hecRegistrationNumber = raw["hecRegistrationNumber"];
    if (category !== undefined) draft.category = category;
    if (typeof nesaIndexNumber === "string") draft.nesaIndexNumber = nesaIndexNumber;
    if (typeof hecRegistrationNumber === "string") draft.hecRegistrationNumber = hecRegistrationNumber;
    if (raw["declaration"] === true) draft.declaration = true;
    return draft;
  } catch {
    return {};
  }
}

function saveDraft(data: WizardData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable — the draft stays in component state.
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — no server data is affected.
  }
}

function academicPathFor(category: ApplicationCategory | undefined): AcademicPath | undefined {
  return category === undefined ? undefined : ACADEMIC_PATH_BY_CATEGORY[category];
}

function StepCategory({ data, onNext }: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Form<{ category: string }> onSubmit={(values) => {
      const category = categoryOrUndefined(values.category);
      if (category !== undefined) onNext({ category });
    }}>
      {({ formProps }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Field
              name="category"
              label={t("apply.category_label")}
              isRequired
              {...(data.category !== undefined ? { defaultValue: data.category } : {})}
            >
              {({ fieldProps }) => {
                const options = APPLICATION_CATEGORIES.map((category) => ({
                  label: t(`apply.categories.${category}`),
                  value: category,
                }));
                const selected = options.find((option) => option.value === fieldProps.value) ?? null;
                return (
                  <Select
                    inputId={fieldProps.id}
                    name={fieldProps.name}
                    options={options}
                    value={selected}
                    placeholder={t("apply.select_category")}
                    isClearable={false}
                    isDisabled={fieldProps.isDisabled}
                    isInvalid={fieldProps.isInvalid}
                    aria-labelledby={fieldProps["aria-labelledby"]}
                    aria-describedby="application-category-help"
                    onChange={(option) => {
                      if (option !== null && option !== undefined) fieldProps.onChange(option.value);
                    }}
                    onBlur={fieldProps.onBlur}
                    onFocus={fieldProps.onFocus}
                  />
                );
              }}
            </Field>
            <Text id="application-category-help" size="small" color="color.text.subtle">
              {t("apply.category_help")}
            </Text>
            {data.category !== undefined && (
              <SectionMessage appearance="information" title={t("apply.agency_derived_title")} headingLevel="h3">
                <Text>{t("apply.agency_derived", { agency: CATEGORY_AGENCY[data.category] })}</Text>
              </SectionMessage>
            )}
            <FormFooter>
              <Button type="submit" appearance="primary">{t("actions.next")}</Button>
            </FormFooter>
          </Stack>
        </form>
      )}
    </Form>
  );
}

function StepEducation({ data, onNext, onBack }: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const path = academicPathFor(data.category);
  return (
    <Form<{ nesaIndexNumber?: string; hecRegistrationNumber?: string }>
      onSubmit={(values) => {
        const value = path === "NESA" ? values.nesaIndexNumber?.trim() : values.hecRegistrationNumber?.trim();
        if (value === undefined || value.length === 0) return;
        onNext(path === "NESA" ? { nesaIndexNumber: value } : { hecRegistrationNumber: value });
      }}
    >
      {({ formProps }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <Text>{t("apply.education_help", { registry: path ?? "" })}</Text>
            {path === "NESA" && (
              <Field
                name="nesaIndexNumber"
                label={t("apply.nesa_label")}
                isRequired
                {...(data.nesaIndexNumber !== undefined ? { defaultValue: data.nesaIndexNumber } : {})}
              >
                {({ fieldProps }) => (
                  <TextField {...fieldProps} required maxLength={64} autoComplete="off" />
                )}
              </Field>
            )}
            {path === "HEC" && (
              <Field
                name="hecRegistrationNumber"
                label={t("apply.hec_label")}
                isRequired
                {...(data.hecRegistrationNumber !== undefined ? { defaultValue: data.hecRegistrationNumber } : {})}
              >
                {({ fieldProps }) => (
                  <TextField {...fieldProps} required maxLength={64} autoComplete="off" />
                )}
              </Field>
            )}
            <Inline space="space.200">
              <Button appearance="subtle" onClick={onBack}>{t("actions.back")}</Button>
              <Button type="submit" appearance="primary">{t("actions.next")}</Button>
            </Inline>
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
      <SectionMessage title={t("apply.declaration_title")} headingLevel="h3">
        <Text>{t("apply.declaration_copy")}</Text>
      </SectionMessage>
      <Inline space="space.100" alignBlock="center">
        <AudioTooltip audioSrc="/audio/declaration-rw.mp3" label={t("apply.listen_declaration")} />
        <Text size="small" color="color.text.subtle">{t("apply.listen_declaration_hint")}</Text>
      </Inline>
      <Inline space="space.200">
        <Button appearance="subtle" onClick={onBack}>{t("actions.back")}</Button>
        <Button appearance="primary" onClick={() => onNext({ declaration: true })}>{t("apply.agree")}</Button>
      </Inline>
    </Stack>
  );
}

function submissionError(error: Error | null): NormalisedError | null {
  return error instanceof ApiError ? error.normalised : null;
}

function backendOutcome(error: NormalisedError): string | null {
  switch (error.kind) {
    case "badRequest": return error.code;
    case "conflict": return error.outcome;
    case "unprocessable": return error.outcome;
    case "unauthenticated": return error.code;
    case "forbidden": return error.code;
    case "g2gUnavailable": return error.authority;
    case "serverError": return error.code;
    default: return null;
  }
}

function SubmissionResult({ result, error, onNewAttempt }: {
  readonly result: "SUBMITTED" | "REPLAYED" | null;
  readonly error: NormalisedError | null;
  readonly onNewAttempt: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  if (result !== null) {
    return (
      <SectionMessage appearance="success" title={result === "REPLAYED" ? t("apply.replay_title") : t("apply.success_title")} headingLevel="h4" aria-live="polite">
        <Stack space="space.200">
          <Text>{result === "REPLAYED" ? t("apply.replay_body") : t("apply.success_body")}</Text>
          <Text><Link to="/status">{t("apply.view_applications")}</Link></Text>
        </Stack>
      </SectionMessage>
    );
  }
  if (error === null) return null;

  const code = backendOutcome(error);
  let title = t("apply.error_title");
  let body = t("errors.generic");
  let appearance: "error" | "warning" = "error";
  let canStartNewAttempt = false;

  switch (error.kind) {
    case "unauthenticated":
      title = t("apply.session_title");
      body = t("apply.session_body");
      break;
    case "forbidden":
      title = t("apply.session_title");
      body = t("apply.forbidden_body");
      break;
    case "badRequest":
    case "unprocessable":
      title = t("apply.validation_title");
      body = t("apply.validation_body");
      canStartNewAttempt = (error.kind === "badRequest" && error.code === "INVALID_IDEMPOTENCY_KEY")
        || (error.kind === "unprocessable" && error.outcome === "KEY_REUSED");
      break;
    case "conflict":
      if (error.outcome === "ALREADY_APPLIED") {
        title = t("apply.duplicate_title");
        body = t("apply.duplicate_body");
      } else {
        title = t("apply.conflict_title");
        body = t(`apply.conflicts.${error.outcome}`, { defaultValue: t("apply.conflict_body") });
      }
      break;
    case "network":
      title = t("apply.offline_title");
      body = t("apply.offline_body");
      appearance = "warning";
      break;
    case "g2gUnavailable":
      title = t("apply.dependency_title");
      body = t("apply.dependency_body");
      appearance = "warning";
      break;
    case "serverError":
      if (error.status === 429) {
        title = t("apply.rate_limit_title");
        body = t("apply.rate_limit_body");
        appearance = "warning";
      } else {
        title = t("apply.error_title");
        body = t("errors.generic");
      }
      break;
    case "malformed":
    case "notFound":
      title = t("apply.error_title");
      body = t("errors.generic");
      break;
  }

  return (
    <SectionMessage appearance={appearance} title={title} headingLevel="h4" aria-live="assertive">
      <Stack space="space.200">
        <Text>{body}</Text>
        {code !== null && <Text size="small" color="color.text.subtle">{t("apply.backend_outcome")} {code}</Text>}
        {canStartNewAttempt && <Button appearance="subtle" onClick={onNewAttempt}>{t("apply.new_attempt")}</Button>}
        {error.kind === "unauthenticated" && <Button appearance="primary" href="/login">{t("apply.sign_in_again")}</Button>}
      </Stack>
    </SectionMessage>
  );
}

export default function ApplyPage(): React.ReactElement {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(loadDraft);
  const [idempotencyKey, setIdempotencyKey] = useState(createUuid);
  const [offlineAttempt, setOfflineAttempt] = useState(false);
  const mutation = useSubmitMyApplication(client);
  const path = academicPathFor(data.category);
  const stepLabels = [
    t("apply.steps.category"),
    t("apply.steps.education"),
    t("apply.steps.declaration"),
    t("apply.steps.review"),
  ];

  const advance = (patch: Partial<WizardData>): void => {
    const updated = { ...data, ...patch };
    setData(updated);
    saveDraft(updated);
    if (patch.category !== undefined || patch.nesaIndexNumber !== undefined || patch.hecRegistrationNumber !== undefined) {
      // A changed request body is a new filing attempt. A retry without edits
      // keeps the existing UUID so the edge can replay safely.
      setIdempotencyKey(createUuid());
      setOfflineAttempt(false);
      mutation.reset();
    }
    setStep((current) => current + 1);
  };

  const back = (): void => setStep((current) => Math.max(0, current - 1));

  const submit = async (): Promise<void> => {
    if (data.category === undefined || path === undefined) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOfflineAttempt(true);
      mutation.reset();
      return;
    }
    setOfflineAttempt(false);
    const input = {
      category: data.category,
      ...(path === "NESA" && data.nesaIndexNumber !== undefined ? { nesaIndexNumber: data.nesaIndexNumber } : {}),
      ...(path === "HEC" && data.hecRegistrationNumber !== undefined ? { hecRegistrationNumber: data.hecRegistrationNumber } : {}),
    };
    try {
      await mutation.mutateAsync({ input, idempotencyKey });
      setOfflineAttempt(false);
      clearDraft();
    } catch {
      // The accessible result below is the user-facing error surface.
    }
  };

  return (
    <WizardLayout title={stepLabels[step] ?? t("apply.title")} currentStep={step} steps={stepLabels} footer={null}>
      {step === 0 && <StepCategory data={data} onNext={advance} />}
      {step === 1 && <StepEducation data={data} onNext={advance} onBack={back} />}
      {step === 2 && <StepDeclaration onNext={advance} onBack={back} />}
      {step === 3 && (
        <Stack space="space.400">
          <SectionMessage title={t("apply.review_title")} headingLevel="h3">
            <Stack space="space.100">
              <Text>{t("apply.review_category")}: {data.category === undefined ? t("apply.not_selected") : t(`apply.categories.${data.category}`)}</Text>
              <Text>{t("apply.review_agency")}: {data.category === undefined ? t("apply.not_selected") : CATEGORY_AGENCY[data.category]}</Text>
              <Text>{t("apply.review_credential")}: {path === "NESA" ? data.nesaIndexNumber : data.hecRegistrationNumber}</Text>
              <Text>{t("apply.review_declaration")}: {data.declaration === true ? t("apply.yes") : t("apply.no")}</Text>
            </Stack>
          </SectionMessage>
          <Text size="small" color="color.text.subtle">{t("apply.review_body")}</Text>
          <SubmissionResult
            result={mutation.data?.outcome ?? null}
            error={offlineAttempt ? { kind: "network" } : submissionError(mutation.error)}
            onNewAttempt={() => { setIdempotencyKey(createUuid()); setOfflineAttempt(false); mutation.reset(); }}
          />
          <Inline space="space.200">
            <Button appearance="subtle" onClick={back} isDisabled={mutation.isPending}>{t("actions.back")}</Button>
            <Button appearance="primary" onClick={() => { void submit(); }} isDisabled={data.declaration !== true || mutation.isPending}>
              {mutation.isPending ? t("apply.submitting") : t("apply.submit")}
            </Button>
          </Inline>
        </Stack>
      )}
    </WizardLayout>
  );
}
