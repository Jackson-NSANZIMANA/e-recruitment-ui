import React, { useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useNidaVerification } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo, AudioTooltip } from "@usrp/ui";
import { BFF_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: BFF_BASE_URL });

// Module-level — xcss prop requires cssMap output, not css().
const pageStyles = cssMap({
  base: {
    maxWidth: "640px",
    marginInline: "auto",
    paddingBlock: token("space.600"),
    paddingInline: token("space.400"),
  },
});

/**
 * Applicant landing / eligibility check page.
 *
 * HCI mandates applied:
 * 1. NIDA "single digital ID integration": do not ask users to type their
 *    name/DOB — ask for their NID, fetch data, ask them to confirm.
 * 2. Pre-submission validation: NIDA check fires on blur, shows instant
 *    "Verified ✓" — reduces cortisol and abandonment rates.
 * 3. Procedural Justice: clear explanation of what NIDA is and why we need it.
 * 4. Audio tooltip available for Kinyarwanda voice guidance.
 * 5. "One-Thing-Per-Page": this page has a single job — verify the NID.
 */
export default function HomePage(): React.ReactElement {
  const { t } = useTranslation();
  const [nid, setNid] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const verifyMutation = useNidaVerification(client);

  const handleVerify = (): void => {
    if (nid.trim().length === 16) {
      void verifyMutation.mutateAsync({ nationalId: nid.trim() });
    }
  };

  const isVerified =
    verifyMutation.isSuccess && verifyMutation.data?.verified === true;

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.600">
        {/* Agency selector — displayed as large, labelled icons (no hamburger menu) */}
        <Stack space="space.200">
          <Heading size="xlarge" as="h1">
            USRP
          </Heading>
          <Text size="large" color="color.text.subtle">
            Unified Security Recruitment Portal
          </Text>
        </Stack>

        <Inline space="space.300" shouldWrap>
          <AgencyLogo agency="RDF" size="md" />
          <AgencyLogo agency="RNP" size="md" />
          <AgencyLogo agency="RCS" size="md" />
        </Inline>

        <SectionMessage title="Before you begin">
          <Text>
            You will need your 16-digit National ID (Indangamuntu). Your name
            and date of birth will be retrieved automatically from the national
            registry — you will not need to type them.
          </Text>
        </SectionMessage>

        <Stack space="space.300">
          <Inline space="space.100" alignBlock="center">
            <Heading size="medium" as="h2">
              Enter your National ID
            </Heading>
            {/* Audio tooltip for Kinyarwanda guidance — HCI mandate */}
            <AudioTooltip
              audioSrc="/audio/nid-guidance-rw.mp3"
              label="Listen in Kinyarwanda"
            />
          </Inline>

          <TextField
            value={nid}
            onChange={(e) => setNid((e.target as HTMLInputElement).value)}
            onBlur={handleVerify}
            placeholder="Enter 16-digit National ID"
            maxLength={16}
            type="text"
            inputMode="numeric"
            pattern="[0-9]{16}"
            aria-label="National ID number"
            autoFocus
          />

          {verifyMutation.isPending && (
            <Inline space="space.100">
              <Spinner size="small" label="Verifying…" />
              <Text size="small" color="color.text.subtle">
                Verifying with National ID Authority…
              </Text>
            </Inline>
          )}

          {isVerified && (
            <Stack space="space.200">
              <SectionMessage appearance="success" title="Identity verified ✓">
                <Text>
                  Welcome,{" "}
                  <strong>{verifyMutation.data?.displayName ?? ""}</strong>. Is
                  this you? If yes, press Continue to start your application.
                </Text>
              </SectionMessage>

              <Inline space="space.200">
                <Button
                  appearance="primary"
                  href="/apply"
                  isDisabled={!confirmed && !isVerified}
                  onClick={() => setConfirmed(true)}
                >
                  {t("actions.next")} — Start application
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() => {
                    setNid("");
                    verifyMutation.reset();
                    setConfirmed(false);
                  }}
                >
                  This is not me
                </Button>
              </Inline>
            </Stack>
          )}

          {verifyMutation.isSuccess &&
            verifyMutation.data?.verified === false && (
              <SectionMessage appearance="error" title="Not found">
                <Text>
                  We could not find this ID in the national registry. Please
                  check the number and try again.
                </Text>
              </SectionMessage>
            )}
        </Stack>
      </Stack>
    </Box>
  );
}
