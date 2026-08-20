import React from "react";
import Lozenge from "@atlaskit/lozenge";
import { useTranslation } from "@usrp/i18n";
import type { ApplicationStatus } from "@usrp/shared-types";
import { statusLozenge } from "../../tokens/usrp-tokens.js";

interface ApplicationStatusBadgeProps {
  readonly status: ApplicationStatus;
}

/**
 * Renders the application lifecycle status as an ADS Lozenge.
 * The label is always translated into the active locale.
 * The colour appearance is driven by `statusLozenge` — no raw colours.
 */
export function ApplicationStatusBadge({
  status,
}: ApplicationStatusBadgeProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Lozenge appearance={statusLozenge[status]}>
      {t(`status.${status}`)}
    </Lozenge>
  );
}
