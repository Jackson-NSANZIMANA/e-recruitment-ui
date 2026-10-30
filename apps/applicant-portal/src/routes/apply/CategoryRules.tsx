import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import SectionMessage from "@atlaskit/section-message";
import type { PublicCategoryEligibility } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_APPLY_NAMESPACES } from "../locales.js";
import { rulesFor } from "./category-rules.js";

/**
 * Who can apply under each category, in plain language (ADR-049, ADR-FE-019): the age limit per
 * qualification, the accepted qualifications ("any one of them") and the science bar. Presentational:
 * the eligibility summary comes from the public campaign detail. Nothing is promised that the
 * platform does not enforce, because the same policy governs the age and academic gates.
 */
export function CategoryRules({ categories, eligibility, labelFor }: {
  readonly categories: readonly string[];
  readonly eligibility: Readonly<Record<string, PublicCategoryEligibility>> | undefined;
  readonly labelFor: (category: string) => string;
}): React.ReactElement | null {
  const { t } = useTranslation(CITIZEN_APPLY_NAMESPACES);
  const rows = categories.flatMap((category) => {
    const view = rulesFor(eligibility, category);
    return view === null ? [] : [{ category, view }];
  });
  if (rows.length === 0) return null;
  return (
    <SectionMessage appearance="information" title={t("category_rules.title")} headingLevel="h3">
      <Stack space="space.200" testId="category-rules">
        <Text>{t("category_rules.intro")}</Text>
        {rows.map(({ category, view }) => (
          <Stack key={category} space="space.050" testId={`category-rules-${category}`}>
            <Text weight="bold" as="strong">{labelFor(category)}</Text>
            <ul>
              {view.bands.map((band, i) => (
                <li key={i}>
                  <Text>
                    {band.qualificationKeys.map((k) => t(k)).join(", ")}
                    {": "}
                    {band.ceilingOnly ? t("category_rules.age_up_to", { max: band.maximumAge }) : t("category_rules.age_range", { min: band.minimumAge, max: band.maximumAge })}
                  </Text>
                </li>
              ))}
            </ul>
            <Text size="small" color="color.text.subtle">
              {t("category_rules.accepted")}: {view.acceptedLevelKeys.map((k) => t("category_rules.at_or_above", { level: t(k) })).join(" · ")}
            </Text>
            {view.sciencePercent !== null && <Text size="small">{t("category_rules.science", { percent: view.sciencePercent })}</Text>}
          </Stack>
        ))}
      </Stack>
    </SectionMessage>
  );
}
