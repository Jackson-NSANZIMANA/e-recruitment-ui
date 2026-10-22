import React from "react";
import EmptyState from "@atlaskit/empty-state";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import Button from "@atlaskit/button/new";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import type { UiStateKind } from "./model.js";

const styles = cssMap({
  center: { paddingBlock: token("space.400"), display: "flex", justifyContent: "center" },
  banner: { paddingBlockEnd: token("space.200") },
});

export interface StateBoundaryProps {
  readonly state: UiStateKind;
  readonly children?: React.ReactNode;
  /** Retry for loading failures; shown on upstream-failure and conflict. */
  readonly onRetry?: () => void;
  /** Shown on filtered-empty. */
  readonly onClearFilters?: () => void;
  /** Per-state copy overrides (already translated). */
  readonly copy?: Partial<Record<UiStateKind, { readonly title?: string; readonly body?: string }>>;
  /** For `conflict`: names the holder, e.g. the agency holding a cross-agency lock. */
  readonly detail?: string;
  readonly testId?: string;
}

const BANNER_APPEARANCE = { partial: "warning", stale: "information" } as const;

/**
 * One place that decides what a screen shows when it is not simply ready.
 * `partial` and `stale` still render the children, under a banner; every other
 * non-ready state replaces them. Copy is trilingual through the common bundle.
 */
export function StateBoundary({ state, children, onRetry, onClearFilters, copy, detail, testId }: StateBoundaryProps): React.ReactElement {
  const { t } = useTranslation();
  if (state === "ready") return <>{children}</>;
  const title = copy?.[state]?.title ?? t(`ui.state.${state}.title`);
  const body = copy?.[state]?.body ?? t(`ui.state.${state}.body`);
  const id = testId ?? `state-${state}`;

  if (state === "loading") {
    return (
      <Box xcss={styles.center} testId={id}>
        <Spinner size="large" label={title} />
      </Box>
    );
  }
  if (state === "partial" || state === "stale") {
    return (
      <Stack space="space.0">
        <Box xcss={styles.banner} testId={id}>
          <SectionMessage appearance={BANNER_APPEARANCE[state]} title={title} headingLevel="h2">
            <Text as="p">{body}</Text>
          </SectionMessage>
        </Box>
        {children}
      </Stack>
    );
  }
  if (state === "upstream-failure" || state === "conflict") {
    return (
      <Box testId={id}>
        <SectionMessage appearance={state === "conflict" ? "warning" : "error"} title={title} headingLevel="h2">
          <Stack space="space.150">
            <Text as="p">{body}</Text>
            {detail !== undefined && <Text as="p" weight="medium">{detail}</Text>}
            {onRetry !== undefined && (
              <Inline><Button appearance="default" onClick={onRetry}>{t("ui.state.retry")}</Button></Inline>
            )}
          </Stack>
        </SectionMessage>
      </Box>
    );
  }
  return (
    <Box testId={id}>
      <EmptyState
        header={title}
        description={body}
        headingLevel={2}
        primaryAction={state === "filtered-empty" && onClearFilters !== undefined ? (
          <Button appearance="primary" onClick={onClearFilters}>{t("ui.state.clearFilters")}</Button>
        ) : undefined}
      />
    </Box>
  );
}
