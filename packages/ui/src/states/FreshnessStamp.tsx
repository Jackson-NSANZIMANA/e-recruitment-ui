import React from "react";
import Lozenge from "@atlaskit/lozenge";
import { Inline, Text } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";
import { freshnessOf } from "./model.js";

export interface FreshnessStampProps {
  readonly updatedAt: string;
  readonly now?: Date;
  readonly staleAfterMinutes?: number;
}

export function FreshnessStamp({ updatedAt, now = new Date(), staleAfterMinutes }: FreshnessStampProps): React.ReactElement {
  const { t } = useTranslation();
  const f = freshnessOf(updatedAt, now, staleAfterMinutes);
  return (
    <Inline space="space.100" alignBlock="center" testId="freshness-stamp">
      <Text size="small" color="color.text.subtle">{t("ui.freshness.updated", { age: t(`ui.age.${f.age.unit}`, { count: f.age.value }) })}</Text>
      {f.stale && <Lozenge appearance="moved">{t("ui.freshness.stale")}</Lozenge>}
    </Inline>
  );
}
