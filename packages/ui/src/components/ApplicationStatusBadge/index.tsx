import React from "react";
import Lozenge from "@atlaskit/lozenge";
import { useTranslation } from "@usrp/i18n";
import type { ApplicationStatus } from "@usrp/contracts";
import { statusLozenge } from "../../tokens/usrp-tokens.js";

interface ApplicationStatusBadgeProps { readonly status: ApplicationStatus | string | null; }

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps): React.ReactElement {
  const { t } = useTranslation();
  if (status === null) return <Lozenge appearance="default">—</Lozenge>;

  const appearance = Object.prototype.hasOwnProperty.call(statusLozenge, status)
    ? statusLozenge[status as ApplicationStatus]
    : "default";
  return <Lozenge appearance={appearance}>{t(`status.${status}`, { defaultValue: status })}</Lozenge>;
}
