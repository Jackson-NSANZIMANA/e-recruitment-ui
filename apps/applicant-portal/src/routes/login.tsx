import React, { useState } from "react";
import { Box, Stack } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import Form, { Field, FormFooter } from "@atlaskit/form";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useAuth } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { ApiError } from "@usrp/api-client";
import { AgencyLogo } from "@usrp/ui";

// Module-level — xcss prop requires cssMap output; css() type is incompatible.
const containerStyles = cssMap({
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    paddingInline: token("space.300"),
  },
});

const cardStyles = cssMap({
  base: {
    borderRadius: token("radius.medium"),
    padding: token("space.500"),
    width: "100%",
    maxWidth: "400px",
    boxShadow: token("elevation.shadow.raised"),
  },
});

interface LoginFormValues {
  email: string;
  password: string;
}

/**
 * Applicant portal login.
 * Applicants authenticate with their email and password (set during
 * registration) — distinct from the officer OTP / agency SSO flow.
 */
export default function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setServerError(t("auth.invalid_credentials"));
      } else {
        setServerError(t("errors.generic"));
      }
    }
  };

  return (
    <Box backgroundColor="color.background.neutral" xcss={containerStyles.base}>
      <Box
        backgroundColor="color.background.input"
        xcss={cardStyles.base}
      >
        <Stack space="space.400">
          <Stack space="space.200" alignInline="center">
            <Heading size="large" as="h1">
              USRP
            </Heading>
            <Stack space="space.100" alignInline="center">
              <AgencyLogo agency="RDF" size="sm" compact />
              <AgencyLogo agency="RNP" size="sm" compact />
              <AgencyLogo agency="RCS" size="sm" compact />
            </Stack>
          </Stack>

          {serverError !== null && (
            <SectionMessage appearance="error">{serverError}</SectionMessage>
          )}

          <Form<LoginFormValues> onSubmit={handleSubmit}>
            {({ formProps, submitting }) => (
              <form {...formProps}>
                <Stack space="space.300">
                  <Field name="email" label={t("auth.email")} isRequired>
                    {({ fieldProps }) => (
                      <TextField
                        {...fieldProps}
                        type="email"
                        autoComplete="email"
                        autoFocus
                        inputMode="email"
                      />
                    )}
                  </Field>
                  <Field name="password" label={t("auth.password")} isRequired>
                    {({ fieldProps }) => (
                      <TextField
                        {...fieldProps}
                        type="password"
                        autoComplete="current-password"
                      />
                    )}
                  </Field>
                  <FormFooter>
                    <LoadingButton
                      type="submit"
                      appearance="primary"
                      isLoading={submitting}
                      shouldFitContainer
                    >
                      {submitting ? t("auth.signing_in") : t("auth.sign_in")}
                    </LoadingButton>
                  </FormFooter>
                </Stack>
              </form>
            )}
          </Form>

          <Button
            appearance="link"
            href="/home"
            shouldFitContainer
          >
            First time? Apply without an account
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
