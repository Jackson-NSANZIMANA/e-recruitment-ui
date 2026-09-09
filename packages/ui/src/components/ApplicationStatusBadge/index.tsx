import React from "react";
import Lozenge from "@atlaskit/lozenge";
import { useTranslation } from "@usrp/i18n";
import type { ApplicationStatus } from "@usrp/contracts";
import { statusLozenge } from "../../tokens/usrp-tokens.js";

interface ApplicationStatusBadgeProps { readonly status: ApplicationStatus; }

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps): React.ReactElement {
  const { t } = useTranslation();
  return <Lozenge appearance={statusLozenge[status]}>{t(`status.${status}`)}</Lozenge>;
}
