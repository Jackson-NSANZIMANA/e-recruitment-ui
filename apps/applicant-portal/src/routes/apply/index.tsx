import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import TextField from "@atlaskit/textfield";
import Select from "@atlaskit/select";
import Form, { Field, FormFooter } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { APPLICATION_CATEGORIES, ACADEMIC_PATH_BY_CATEGORY, AGENCY_DOCUMENT_TYPES, CATEGORY_AGENCY, isRehearsalCampaign, type Agency, type ApplicationCategory } from "@usrp/contracts";
import {
  ApiError,
  createApiClient,
  getMyDocumentChecklist,
  isUnconfirmedUploadOutcome,
  useMyDocumentChecklist,
  useMyIdentity,
  usePublicCampaign,
  usePublicCampaigns,
  useSubmitMyApplication,
  useUploadMyDocument,
  type NormalisedError,
  type PublicCampaign,
  type UploadDocumentResponse,
} from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_APPLY_NAMESPACES } from "../locales.js";
import { WizardLayout, AudioTooltip } from "@usrp/ui";
import { EDGE_BASE_URL } from "../../env.js";
import { nidaRows, sexKey } from "./nida-identity.js";
import { CategoryRules } from "./CategoryRules.js";
import { backendOutcome, DocumentsPanel } from "../documents/DocumentsPanel.js";

// The documents panel lives with the documents screen; it is re-exported for the apply journey's tests.
export { DocumentsPanel };

const STORAGE_KEY = "usrp_apply_draft";
const client = createApiClient({ baseUrl: EDGE_BASE_URL });

type AcademicPath = "NESA" | "HEC";

interface WizardData {
  /**
   * The PUBLIC code of the campaign the citizen chose (ADR-030). The server
   * resolves the real campaign and policy from it; the label and categories
   * are only what the picker showed, kept so the wizard can narrow choices.
   */
  readonly campaignCode?: string;
  readonly campaignLabel?: string;
  readonly campaignCategories?: readonly ApplicationCategory[];
  /** Required business input accepted by the edge. */
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
    const draft: {
      campaignCode?: string;
      campaignLabel?: string;
      campaignCategories?: readonly ApplicationCategory[];
      category?: ApplicationCategory;
      nesaIndexNumber?: string;
      hecRegistrationNumber?: string;
      declaration?: boolean;
    } = {};
    const campaignCode = raw["campaignCode"];
    const campaignLabel = raw["campaignLabel"];
    const campaignCategories = raw["campaignCategories"];
    if (typeof campaignCode === "string") draft.campaignCode = campaignCode;
    if (typeof campaignLabel === "string") draft.campaignLabel = campaignLabel;
    if (Array.isArray(campaignCategories)) {
      draft.campaignCategories = campaignCategories
        .map(categoryOrUndefined)
        .filter((c): c is ApplicationCategory => c !== undefined);
    }
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

function StepCampaign({ data, onNext }: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const campaigns = usePublicCampaigns(client);

  if (campaigns.isPending) return <Text size="large">{t("apply.campaign_loading")}</Text>;
  if (campaigns.isError) {
    return (
      <SectionMessage appearance="warning" title={t("apply.campaign_error_title")} headingLevel="h3">
        <Stack space="space.200">
          <Text size="large">{t("apply.campaign_error_body")}</Text>
          <Button onClick={() => { void campaigns.refetch(); }}>{t("apply.retry")}</Button>
        </Stack>
      </SectionMessage>
    );
  }
  const open: readonly PublicCampaign[] = campaigns.data.campaigns;
  if (open.length === 0) {
    return (
      <SectionMessage title={t("apply.campaign_none_title")} headingLevel="h3">
        <Text size="large">{t("apply.campaign_none_body")}</Text>
      </SectionMessage>
    );
  }
  return (
    <Stack space="space.300">
      <Text size="large">{t("apply.campaign_help")}</Text>
      {open.map((campaign) => {
        // A rehearsal is practice on the real platform; it must never pass for a real recruitment.
        const rehearsal = isRehearsalCampaign(campaign);
        return (
        <SectionMessage
          key={campaign.publicCode}
          appearance={rehearsal ? "warning" : data.campaignCode === campaign.publicCode ? "success" : "information"}
          title={campaign.campaignLabel}
          headingLevel="h3"
        >
          <Stack space="space.100">
            {rehearsal && <Text size="large" weight="bold">{t("rehearsal.apply_notice")}</Text>}
            <Text size="large">{t("apply.review_agency")}: {campaign.agency}</Text>
            <Text size="large" color="color.text.subtle">
              {t("apply.campaign_window", { date: new Date(campaign.registrationClosesAt).toLocaleDateString() })}
            </Text>
            <Inline>
              <Button
                appearance="primary"
                onClick={() => onNext({
                  campaignCode: campaign.publicCode,
                  campaignLabel: campaign.campaignLabel,
                  campaignCategories: campaign.targetCategories,
                })}
              >
                {t("apply.campaign_choose")}
              </Button>
            </Inline>
          </Stack>
        </SectionMessage>
        );
      })}
    </Stack>
  );
}

function StepCategory({ data, onNext, onBack }: {
  readonly data: WizardData;
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  // Only the categories THIS campaign targets can be chosen. The server
  // re-checks; this just stops a citizen picking something it will refuse.
  const offered = APPLICATION_CATEGORIES.filter(
    (c) => data.campaignCategories === undefined || data.campaignCategories.includes(c),
  );
  // ADR-049: the rules per qualification come from the campaign's public detail; absent for a v1 campaign.
  const detail = usePublicCampaign(client, data.campaignCode ?? null);
  return (
    <Form<{ category: string }> onSubmit={(values) => {
      const category = categoryOrUndefined(values.category);
      if (category !== undefined) onNext({ category });
    }}>
      {({ formProps }) => (
        <form {...formProps}>
          <Stack space="space.400">
            <CategoryRules
              categories={offered}
              eligibility={detail.data?.campaign.eligibility}
              labelFor={(category) => t(`apply.categories.${category}`)}
            />
            <Field
              name="category"
              label={t("apply.category_label")}
              isRequired
              {...(data.category !== undefined ? { defaultValue: data.category } : {})}
            >
              {({ fieldProps }) => {
                const options = offered.map((category) => ({
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
            <Text id="application-category-help" size="large" color="color.text.subtle">
              {t("apply.category_help")}
            </Text>
            {data.category !== undefined && (
              <SectionMessage appearance="information" title={t("apply.agency_derived_title")} headingLevel="h3">
                <Text size="large">{t("apply.agency_derived", { agency: CATEGORY_AGENCY[data.category] })}</Text>
              </SectionMessage>
            )}
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
            <Text size="large">{t("apply.education_help", { registry: path ?? "" })}</Text>
            {path === "NESA" && (
              <Field
                name="nesaIndexNumber"
                label={t("apply.nesa_label")}
                isRequired
                defaultValue={data.nesaIndexNumber ?? ""}
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
                defaultValue={data.hecRegistrationNumber ?? ""}
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

/**
 * Identity as recorded by NIDA, read-only (ADR-FE-019). Nothing here is editable: a wrong
 * value is corrected with NIDA, never in this form. A failed read never blocks the wizard.
 */
function NidaIdentityBlock(): React.ReactElement | null {
  const { t } = useTranslation(CITIZEN_APPLY_NAMESPACES);
  const identity = useMyIdentity(client);
  if (identity.isPending) return null;
  if (identity.isError) {
    return <SectionMessage appearance="information"><Text size="large">{t("apply.nida_unavailable")}</Text></SectionMessage>;
  }
  const label = (key: string, value: string | null): string => {
    if (value === null) return t("apply.nida_not_held");
    if (key === "sex") return t(`apply.nida_${sexKey(value === "FEMALE" ? "FEMALE" : "MALE")}`);
    return value;
  };
  return (
    <SectionMessage title={t("apply.nida_title")} headingLevel="h3" appearance="information">
      <Stack space="space.100">
        <Text size="large">{t("apply.nida_body")}</Text>
        <Stack space="space.050" testId="nida-identity">
          {nidaRows(identity.data).map((row) => (
            <Inline key={row.key} space="space.100">
              <Text size="large" weight="bold">{t(`apply.nida_${row.key}`)}</Text>
              <Text size="large">{label(row.key, row.value)}{row.value === null ? ` (${t("apply.nida_asked")})` : ""}</Text>
            </Inline>
          ))}
        </Stack>
      </Stack>
    </SectionMessage>
  );
}

function StepDeclaration({ onNext, onBack }: {
  readonly onNext: (patch: Partial<WizardData>) => void;
  readonly onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Stack space="space.400">
      <NidaIdentityBlock />
      <SectionMessage title={t("apply.declaration_title")} headingLevel="h3">
        <Text size="large">{t("apply.declaration_copy")}</Text>
      </SectionMessage>
      <Inline space="space.100" alignBlock="center">
        <AudioTooltip audioSrc="/audio/declaration-rw.mp3" label={t("apply.listen_declaration")} />
        <Text size="large" color="color.text.subtle">{t("apply.listen_declaration_hint")}</Text>
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

function SubmissionResult({ result, applicationId, agency, error, onNewAttempt }: {
  readonly result: "SUBMITTED" | "REPLAYED" | null;
  readonly applicationId: string | null;
  readonly agency: Agency | null;
  readonly error: NormalisedError | null;
  readonly onNewAttempt: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  if (result !== null) {
    return (
      <SectionMessage appearance="success" title={result === "REPLAYED" ? t("apply.replay_title") : t("apply.success_title")} headingLevel="h4" aria-live="polite">
        <Stack space="space.200">
          <Text size="large">{result === "REPLAYED" ? t("apply.replay_body") : t("apply.success_body")}</Text>
          {applicationId !== null && (
            <Text size="large"><Link to={`/applications/${applicationId}/exam-qr`}>{t("exam_qr.open_link")}</Link>{" · "}<Link to={`/applications/${applicationId}/documents`}>{t("citizen_docs.open_link")}</Link></Text>
          )}
          {applicationId !== null && agency !== null && (
            <DocumentsPanel applicationId={applicationId} agency={agency} />
          )}
          <Text size="large"><Link to="/status">{t("apply.view_applications")}</Link></Text>
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
        <Text size="large">{body}</Text>
        {code !== null && <Text size="large" color="color.text.subtle">{t("apply.backend_outcome")} {code}</Text>}
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
    t("apply.steps.campaign"),
    t("apply.steps.category"),
    t("apply.steps.education"),
    t("apply.steps.declaration"),
    t("apply.steps.review"),
  ];

  const advance = (patch: Partial<WizardData>): void => {
    let updated: WizardData = { ...data, ...patch };
    if (
      updated.category !== undefined &&
      updated.campaignCategories !== undefined &&
      !updated.campaignCategories.includes(updated.category)
    ) {
      // A different campaign invalidates a category chosen for another.
      const { category: _dropped, ...rest } = updated;
      updated = rest;
    }
    setData(updated);
    saveDraft(updated);
    if (patch.campaignCode !== undefined || patch.category !== undefined || patch.nesaIndexNumber !== undefined || patch.hecRegistrationNumber !== undefined) {
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
    if (data.category === undefined || data.campaignCode === undefined || path === undefined) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOfflineAttempt(true);
      mutation.reset();
      return;
    }
    setOfflineAttempt(false);
    const input = {
      category: data.category,
      campaignCode: data.campaignCode,
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
      {step === 0 && <StepCampaign data={data} onNext={advance} />}
      {step === 1 && <StepCategory data={data} onNext={advance} onBack={back} />}
      {step === 2 && <StepEducation data={data} onNext={advance} onBack={back} />}
      {step === 3 && <StepDeclaration onNext={advance} onBack={back} />}
      {step === 4 && (
        <Stack space="space.400">
          <SectionMessage title={t("apply.review_title")} headingLevel="h3">
            <Stack space="space.100">
              <Text size="large">{t("apply.review_campaign")}: {data.campaignLabel ?? data.campaignCode ?? t("apply.not_selected")}</Text>
              <Text size="large">{t("apply.review_category")}: {data.category === undefined ? t("apply.not_selected") : t(`apply.categories.${data.category}`)}</Text>
              <Text size="large">{t("apply.review_agency")}: {data.category === undefined ? t("apply.not_selected") : CATEGORY_AGENCY[data.category]}</Text>
              <Text size="large">{t("apply.review_credential")}: {path === "NESA" ? data.nesaIndexNumber : data.hecRegistrationNumber}</Text>
              <Text size="large">{t("apply.review_declaration")}: {data.declaration === true ? t("apply.yes") : t("apply.no")}</Text>
            </Stack>
          </SectionMessage>
          <Text size="large" color="color.text.subtle">{t("apply.review_body")}</Text>
          <SubmissionResult
            result={mutation.data?.outcome ?? null}
            applicationId={mutation.data?.response.applicationId ?? null}
            agency={mutation.data?.response.agency ?? null}
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
