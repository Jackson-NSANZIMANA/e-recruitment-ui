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
import { EDGE_BASE_URL } from "../env.js";

const containerStyles = cssMap({ base: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", paddingInline: token("space.300") } });
const cardStyles = cssMap({ base: { borderRadius: token("radius.medium"), padding: token("space.500"), width: "100%", maxWidth: "400px", boxShadow: token("elevation.shadow.raised") } });
interface NationalIdFormValues { readonly nationalId: string; }
interface OtpFormValues { readonly otp: string; }

export default function LoginPage(): React.ReactElement {
  const { t } = useTranslation();
  const applicant = useApplicantAuth(EDGE_BASE_URL);
  const { otp } = applicant;
  useEffect(() => { if (otp.status === "verified") window.location.assign("/"); }, [otp.status]);
  const awaitingCode = otp.status === "challenged" || otp.status === "rejected" || otp.status === "verifying";
  const secondsLeft = Math.ceil(applicant.millisLeft / 1000);

  return (
    <Box backgroundColor="color.background.neutral" xcss={containerStyles.base}>
      <Box backgroundColor="color.background.input" xcss={cardStyles.base}>
        <Stack space="space.400">
          <Stack space="space.200" alignInline="center"><Heading size="large" as="h1">USRP</Heading><Stack space="space.100" alignInline="center"><AgencyLogo agency="RDF" size="sm" compact /><AgencyLogo agency="RNP" size="sm" compact /><AgencyLogo agency="RCS" size="sm" compact /></Stack></Stack>
          {applicant.message !== null && <SectionMessage appearance={otp.status === "challenged" ? "information" : "warning"} title="Authentication status" headingLevel="h3"><Text>{applicant.message}</Text></SectionMessage>}
          {!awaitingCode && otp.status !== "verified" && <Form<NationalIdFormValues> onSubmit={(values) => applicant.requestCode(values.nationalId.trim())}>{({ formProps, submitting }) => <form {...formProps}><Stack space="space.300"><Field name="nationalId" label="National ID number" isRequired>{({ fieldProps }) => <TextField {...fieldProps} type="text" inputMode="numeric" maxLength={16} autoComplete="off" autoFocus />}</Field><FormFooter><LoadingButton type="submit" appearance="primary" isLoading={submitting || otp.status === "requesting"} shouldFitContainer>{t("auth.sign_in")}</LoadingButton></FormFooter></Stack></form>}</Form>}
          {awaitingCode && <Form<OtpFormValues> onSubmit={(values) => applicant.submitCode(values.otp.trim())}>{({ formProps, submitting }) => <form {...formProps}><Stack space="space.300"><Field name="otp" label="One-time code" isRequired>{({ fieldProps }) => <TextField {...fieldProps} type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus />}</Field><Text size="small" color="color.text.subtle">{applicant.attemptsLeft} attempts remaining, {secondsLeft}s left</Text><FormFooter><Inline space="space.200"><LoadingButton type="submit" appearance="primary" isLoading={submitting || otp.status === "verifying"} isDisabled={!applicant.canSubmitCode}>{t("actions.confirm")}</LoadingButton><Button appearance="subtle" onClick={applicant.reset}>{t("actions.cancel")}</Button></Inline></FormFooter></Stack></form>}</Form>}
          {applicant.offerWalkIn && <SectionMessage appearance="information" title={WALK_IN_FALLBACK_TITLE} headingLevel="h3"><Stack space="space.200"><Text>{WALK_IN_FALLBACK_BODY}</Text><Button appearance="subtle" onClick={applicant.reset}>{t("actions.back")}</Button></Stack></SectionMessage>}
        </Stack>
      </Box>
    </Box>
  );
}
