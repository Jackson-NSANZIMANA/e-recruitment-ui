import React from "react";
import { IconButton } from "@atlaskit/button/new";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import { Inline } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";
import { Card } from "./Card.js";

export interface WidgetProps {
  readonly title: string;
  readonly description?: string;
  /** When given, a refresh button joins the widget's toolbar. */
  readonly onRefresh?: () => void;
  /** Extra toolbar controls, before refresh. */
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly testId?: string;
}

/**
 * A dashboard widget: a raised card with a brand rule across the top, a title,
 * and a toolbar. Every widget can refresh its own read, so one slow panel never
 * means reloading the page.
 */
export function Widget({ title, description, onRefresh, actions, children, testId }: WidgetProps): React.ReactElement {
  const { t } = useTranslation();
  const toolbar = (actions !== undefined || onRefresh !== undefined) ? (
    <Inline space="space.050" alignBlock="center">
      {actions}
      {onRefresh !== undefined && <IconButton icon={RefreshIcon} label={t("chart.refresh", { title })} appearance="subtle" spacing="compact" onClick={onRefresh} />}
    </Inline>
  ) : undefined;
  return (
    <Card accent title={title} titleLevel={2} {...(description !== undefined ? { description } : {})} {...(toolbar !== undefined ? { actions: toolbar } : {})} {...(testId !== undefined ? { testId } : {})}>
      {children}
    </Card>
  );
}
