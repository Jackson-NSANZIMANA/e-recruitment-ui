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

// Module-level — xcss prop requires cssMap output; css() type is incompatible.
const containerStyles = cssMap({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
});

const cardStyles = cssMap({
  base: {
    // borderRadius added to cssMap — moving from inline style per ADS rule.
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

export default function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      // AuthProvider state update triggers re-render → RouteGuard redirects.
    } catch (err) {
      if (
        (err instanceof ApiError && err.isUnauthorized) ||
        (err instanceof Error && err.message.toLowerCase().includes("invalid"))
      ) {
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
        xcss={cardStyles['base']}
      >
        <Stack space="space.400">
          <Heading size="large" as="h1">
            USRP
          </Heading>
          <Heading size="medium" as="h2">
            {t("auth.sign_in")}
          </Heading>

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
        </Stack>
      </Box>
    </Box>
  );
}
