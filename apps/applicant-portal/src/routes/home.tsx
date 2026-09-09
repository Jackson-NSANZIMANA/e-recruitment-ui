import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { useAuth } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo } from "@usrp/ui";

const pageStyles = cssMap({
  base: {
    maxWidth: "640px",
    marginInline: "auto",
    paddingBlock: token("space.600"),
    paddingInline: token("space.400"),
  },
});

/**
 * The authenticated applicant landing page.
 *
 * There is deliberately NO National ID field here. Identity was established by
 * the OTP challenge at /login, and re-checking a National ID on a citizen
 * surface would rebuild the enumeration oracle ADR-021 refuses to expose.
 *
 * What is offered is only what the platform can serve a citizen today. Filing a
 * new application is NOT among it: POST /v1/applications is service-internal and
 * has no citizen path through the edge yet, so /apply collects a draft and says
 * so rather than presenting a Submit button that cannot work.
 */
export default function HomePage(): React.ReactElement {
  const { t } = useTranslation();
  const { state } = useAuth();
  const isApplicant = state.status === "authenticated" && state.session.kind === "applicant";

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.600">
        <Stack space="space.200">
          <Heading size="xlarge" as="h1">USRP</Heading>
          <Text size="large" color="color.text.subtle">
            Unified Security Recruitment Portal
          </Text>
        </Stack>

        <Inline space="space.300" shouldWrap>
          <AgencyLogo agency="RDF" size="md" />
          <AgencyLogo agency="RNP" size="md" />
          <AgencyLogo agency="RCS" size="md" />
        </Inline>

        {!isApplicant && (
          <SectionMessage appearance="warning">
            <Text>{t("errors.generic")}</Text>
          </SectionMessage>
        )}

        <Stack space="space.300">
          <Heading size="medium" as="h2">{t("nav.applications")}</Heading>
          <Text color="color.text.subtle">
            You can review the applications you have already filed, and their
            current status, across all three agencies.
          </Text>
          <Inline space="space.200" shouldWrap>
            <Button appearance="primary" href="/status">{t("actions.view")}</Button>
            <Button appearance="default" href="/apply">{t("actions.next")}</Button>
          </Inline>
        </Stack>
      </Stack>
    </Box>
  );
}
