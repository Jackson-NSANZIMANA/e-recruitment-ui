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
import { createApiClient, useNidaVerification, useWalkIn } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { BFF_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: BFF_BASE_URL });

// Module-level — xcss prop requires cssMap output, not css().
const pageStyles = cssMap({
  base: {
    maxWidth: "600px",
    marginInline: "auto",
    paddingBlock: token("space.500"),
    paddingInline: token("space.400"),
  },
  successSpacing: {
    marginTop: token("space.300"),
  },
});

interface WalkInFormValues {
  nationalIdInput: string;
  postCode: string;
}

/**
 * Walk-in lane — field officer intake form.
 *
 * HCI field tablet mandates applied:
 * - NIDA pre-submission validation fires as the officer types the NID —
 *   green "Verified ✓" checkmark appears instantly (anticipatory feedback,
 *   reduces queue anxiety).
 * - 48×48 px minimum touch targets enforced by ADS Button defaults.
 * - Haptic confirmation on successful walk-in registration (vibrate API).
 * - Single-screen form; no pagination needed (officer is processing 1 candidate).
 */
export default function WalkInPage(): React.ReactElement {
  const { t } = useTranslation();
  const [nidInput, setNidInput] = useState("");
  const [success, setSuccess] = useState(false);

  const verifyMutation = useNidaVerification(client);
  const walkInMutation = useWalkIn(client);

  const handleNidBlur = (): void => {
    if (nidInput.length === 16) {
      void verifyMutation.mutateAsync({ nationalId: nidInput });
    }
  };

  const handleSubmit = async (values: WalkInFormValues): Promise<void> => {
    const result = await walkInMutation.mutateAsync({
      nationalIdHash: values.nationalIdInput,
      postCode: values.postCode,
    });
    if (result !== undefined) {
      if (navigator.vibrate !== undefined) navigator.vibrate([100, 50, 100]);
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage appearance="success" title="Walk-in registered">
          The applicant has been added to the queue. You can now process the
          next candidate.
        </SectionMessage>
        <Box xcss={pageStyles.successSpacing}>
          <Button
            appearance="primary"
            onClick={() => {
              setSuccess(false);
              setNidInput("");
              verifyMutation.reset();
              walkInMutation.reset();
            }}
          >
            Next candidate
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <Heading size="large" as="h1">
          {t("nav.walk_in")}
        </Heading>

        {walkInMutation.isError && (
          <SectionMessage appearance="error">
            {t("errors.generic")}
          </SectionMessage>
        )}

        <Form<WalkInFormValues> onSubmit={handleSubmit}>
          {({ formProps, submitting }) => (
            <form {...formProps}>
              <Stack space="space.400">
                <Field
                  name="nationalIdInput"
                  label="National ID number"
                  isRequired
                >
                  {({ fieldProps }) => (
                    <Stack space="space.100">
                      <TextField
                        {...fieldProps}
                        value={nidInput}
                        onChange={(e) =>
                          setNidInput((e.target as HTMLInputElement).value)
                        }
                        onBlur={handleNidBlur}
                        placeholder="16-digit NID"
                        maxLength={16}
                        autoFocus
                      />
                      {verifyMutation.isPending && (
                        <Text size="small" color="color.text.subtle">
                          Verifying with NIDA…
                        </Text>
                      )}
                      {verifyMutation.isSuccess &&
                        verifyMutation.data?.verified === true && (
                          <Text size="small" color="color.text.success">
                            ✓ Verified — {verifyMutation.data.displayName}
                          </Text>
                        )}
                      {verifyMutation.isSuccess &&
                        verifyMutation.data?.verified === false && (
                          <Text size="small" color="color.text.danger">
                            ✗ NID not found in NIDA registry
                          </Text>
                        )}
                    </Stack>
                  )}
                </Field>

                <Field name="postCode" label="Recruitment post code" isRequired>
                  {({ fieldProps }) => (
                    <TextField {...fieldProps} placeholder="e.g. RDF-98001" />
                  )}
                </Field>

                <FormFooter>
                  <Inline space="space.200">
                    <LoadingButton
                      type="submit"
                      appearance="primary"
                      isLoading={submitting || walkInMutation.isPending}
                      isDisabled={
                        verifyMutation.isSuccess &&
                        verifyMutation.data?.verified === false
                      }
                    >
                      Register walk-in
                    </LoadingButton>
                    <Button href="/dashboard" appearance="subtle">
                      {t("actions.cancel")}
                    </Button>
                  </Inline>
                </FormFooter>
              </Stack>
            </form>
          )}
        </Form>
      </Stack>
    </Box>
  );
}
