import React, { useEffect } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import Form, { Field, FormFooter } from "@atlaskit/form";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useApplicantAuth, WALK_IN_FALLBACK_TITLE, WALK_IN_FALLBACK_BODY } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo } from "@usrp/ui";

const containerStyles = cssMap({ base: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", paddingInline: token("space.300") } });
const cardStyles = cssMap({ base: { borderRadius: token("radius.medium"), padding: token("space.500"), width: "100%", maxWidth: "400px", boxShadow: token("elevation.shadow.raised") } });
interface IdentityFormValues { readonly nationalId: string; readonly dateOfBirth: string; }
interface PhoneFormValues { readonly phoneNumber: string; }
interface OtpFormValues { readonly otp: string; }

// ══════════════════════════════════════════════════════════════════
// identity — citizen sign-in: National ID + date of birth -> phone -> OTP
// (ADR-018, ADR-021). Moved from apps/applicant-portal/src/routes/login.tsx in
// S02 (ADR-FE-007 §5). @usrp/auth owns the challenge; the host supplies the edge
// base URL. No copy here may say whether a message was sent (OTP_REQUEST_TELLS_US).
// ══════════════════════════════════════════════════════════════════

export interface CitizenLoginPageProps {
  /** The edge origin from the host app's env ("" in dev: same-origin proxy). */
  readonly edgeBaseUrl: string;
}

export default function CitizenLoginPage({ edgeBaseUrl }: CitizenLoginPageProps): React.ReactElement {
  const { t } = useTranslation();
  const applicant = useApplicantAuth(edgeBaseUrl);
  const { otp } = applicant;
  useEffect(() => { if (otp.status === "verified") window.location.assign("/"); }, [otp.status]);
  const awaitingCode = otp.status === "challenged" || otp.status === "rejected" || otp.status === "verifying";
  // ID + date of birth → phone → code. The phone is asked for only AFTER NIDA
  // has confirmed a Rwandan citizen whose date of birth matches.
  const identityConfirmed = applicant.identity.status === "confirmed";
  const showIdentityStep = !identityConfirmed && otp.status !== "verified";
  const showPhoneStep = identityConfirmed && !awaitingCode && otp.status !== "verified";
  const secondsLeft = Math.ceil(applicant.millisLeft / 1000);

  return (
    <Box backgroundColor="color.background.neutral" xcss={containerStyles.base}>
      <Box backgroundColor="color.background.input" xcss={cardStyles.base}>
        <Stack space="space.400">
          <Stack space="space.200" alignInline="center"><Heading size="large" as="h1">USRP</Heading><Inline space="space.200" alignBlock="center"><AgencyLogo agency="RDF" size="md" compact /><AgencyLogo agency="RNP" size="md" compact /><AgencyLogo agency="RCS" size="md" compact /></Inline></Stack>
          {applicant.message !== null && <SectionMessage appearance={otp.status === "challenged" ? "information" : "warning"} title="Authentication status" headingLevel="h3"><Text>{applicant.message}</Text></SectionMessage>}
          {showIdentityStep && <Form<IdentityFormValues> onSubmit={(values) => applicant.confirmIdentity(values.nationalId.trim(), values.dateOfBirth)}>{({ formProps, submitting }) => <form {...formProps}><Stack space="space.300"><Field name="nationalId" label="National ID number" isRequired defaultValue="">{({ fieldProps }) => <TextField {...fieldProps} type="text" inputMode="numeric" maxLength={16} autoComplete="off" autoFocus />}</Field><Field name="dateOfBirth" label="Date of birth" isRequired defaultValue="">{({ fieldProps }) => <TextField {...fieldProps} type="date" autoComplete="bday" />}</Field><FormFooter><LoadingButton type="submit" appearance="primary" isLoading={submitting || applicant.identity.status === "confirming"} shouldFitContainer>{t("actions.continue")}</LoadingButton></FormFooter></Stack></form>}</Form>}
          {showPhoneStep && <Form<PhoneFormValues> onSubmit={(values) => applicant.requestCode(values.phoneNumber.trim())}>{({ formProps, submitting }) => <form {...formProps}><Stack space="space.300"><Text>Your identity is confirmed. Enter the mobile number (MTN or Airtel) where we should send your code.</Text><Field name="phoneNumber" label="Mobile phone number" isRequired defaultValue="">{({ fieldProps }) => <TextField {...fieldProps} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" autoFocus />}</Field><FormFooter><Inline space="space.200"><LoadingButton type="submit" appearance="primary" isLoading={submitting || otp.status === "requesting"}>{t("auth.send_code")}</LoadingButton><Button appearance="subtle" onClick={applicant.reset}>{t("actions.back")}</Button></Inline></FormFooter></Stack></form>}</Form>}
          {awaitingCode && <Form<OtpFormValues> onSubmit={(values) => applicant.submitCode(values.otp.trim())}>{({ formProps, submitting }) => <form {...formProps}><Stack space="space.300"><Field name="otp" label="One-time code" isRequired defaultValue="">{({ fieldProps }) => <TextField {...fieldProps} type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus />}</Field><Text size="small" color="color.text.subtle">{applicant.attemptsLeft} attempts remaining, {secondsLeft}s left</Text><FormFooter><Inline space="space.200"><LoadingButton type="submit" appearance="primary" isLoading={submitting || otp.status === "verifying"} isDisabled={!applicant.canSubmitCode}>{t("actions.confirm")}</LoadingButton><Button appearance="subtle" onClick={applicant.reset}>{t("actions.cancel")}</Button></Inline></FormFooter></Stack></form>}</Form>}
          {applicant.offerWalkIn && <SectionMessage appearance="information" title={WALK_IN_FALLBACK_TITLE} headingLevel="h3"><Stack space="space.200"><Text>{WALK_IN_FALLBACK_BODY}</Text><Button appearance="subtle" onClick={applicant.reset}>{t("actions.back")}</Button></Stack></SectionMessage>}
        </Stack>
      </Box>
    </Box>
  );
}
