import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack } from "@atlaskit/primitives/compiled";
import LoadingButton from "@atlaskit/button/loading-button";
import Form, { Field, FormFooter } from "@atlaskit/form";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import Heading from "@atlaskit/heading";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useAuth } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";

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
    borderRadius: token("radius.medium"),
    padding: token("space.500"),
    width: "100%",
    maxWidth: "400px",
    boxShadow: token("elevation.shadow.raised"),
  },
});

interface LoginFormValues {
  readonly loginHandle: string;
  readonly password: string;
}

export default function LoginPage(): React.ReactElement | null {
  const navigate = useNavigate();
  const { state, signInOfficer } = useAuth();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);

  // Login is not a destination for an authenticated officer. This also covers
  // an existing session discovered by AuthProvider before the user submits.
  useEffect(() => {
    if (state.status === "authenticated" && state.session.kind === "officer") {
      void navigate("/dashboard", { replace: true });
    }
  }, [navigate, state]);

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    const message = await signInOfficer(values.loginHandle, values.password);
    if (message !== null) setServerError(message);
  };

  if (state.status === "authenticated" && state.session.kind === "officer") {
    return null;
  }

  return (
    <Box backgroundColor="color.background.neutral" xcss={containerStyles.base}>
      <Box backgroundColor="color.background.input" xcss={cardStyles.base}>
        <Stack space="space.400">
          <Heading size="large" as="h1">
            USRP
          </Heading>
          <Heading size="medium" as="h2">
            {t("auth.sign_in")}
          </Heading>

          {serverError !== null && (
            <SectionMessage appearance="error" title={t("auth.invalid_credentials")}>
              <p role="alert">{serverError}</p>
            </SectionMessage>
          )}

          <Form<LoginFormValues> onSubmit={handleSubmit}>
            {({ formProps, submitting }) => (
              <form {...formProps} aria-label={t("auth.sign_in")} noValidate>
                <Stack space="space.300">
                  <Field name="loginHandle" label="Login handle" isRequired>
                    {({ fieldProps }) => (
                      <TextField
                        {...fieldProps}
                        name="loginHandle"
                        id="loginHandle"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        testId="login-handle-input"
                      />
                    )}
                  </Field>

                  <Field name="password" label={t("auth.password")} isRequired>
                    {({ fieldProps }) => (
                      <TextField
                        {...fieldProps}
                        name="password"
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        testId="password-input"
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
