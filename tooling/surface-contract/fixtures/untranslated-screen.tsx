// selftest fixture: a built-looking screen whose key exists in no locale bundle.
import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";

export default function UntranslatedScreen(): React.ReactElement {
  const { t } = useTranslation();
  const isLoading = false;
  return (
    <Stack space="space.200">
      <Text as="p">{t("selftest_only.never_translated")}</Text>
      <Text as="p">{isLoading ? t("a11y.loading") : t("errors.generic")}</Text>
    </Stack>
  );
}
