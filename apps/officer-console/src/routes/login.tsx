import React, { useState } from "react";
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

export default function LoginPage(): React.ReactElement {
  const { signInOfficer } = useAuth();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    // signInOfficer resolves to an error message on failure, or null on success —
    // the caller (this component) owns turning that into UI, not the auth hook.
    const message = await signInOfficer(values.loginHandle, values.password);
    if (message !== null) setServerError(message);
  };

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
            <SectionMessage appearance="error">{serverError}</SectionMessage>
          )}

          <Form<LoginFormValues> onSubmit={handleSubmit}>
            {({ formProps, submitting }) => (
              <form {...formProps}>
                <Stack space="space.300">
                  <Field name="loginHandle" label="Login handle" isRequired>
                    {({ fieldProps }) => (
                      <TextField
                        {...fieldProps}
                        type="text"
                        autoComplete="username"
                        autoFocus
                      />
                    )}
                  </Field>

                  <Field name="password" label={t("auth.password")} isRequired>
                    {({ fieldProps }) => (
                      <TextField {...fieldProps} type="password" autoComplete="current-password" />
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