import React from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

type SyncStatus = "offline" | "syncing" | "synced";

interface OfflineIndicatorProps {
  readonly status: SyncStatus;
  readonly testId?: string;
}

// cssMap at module scope — two variants for offline/syncing states.
const containerStyles = cssMap({
  base: {
    position: "fixed",
    bottom: token("space.200"),
    insetInlineStart: "50%",
    transform: "translateX(-50%)",
    paddingBlock: token("space.150"),
    paddingInline: token("space.300"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderRadius: token("radius.medium"),
    boxShadow: token("elevation.shadow.overlay"),
  },
  offline: {
    borderColor: token("color.border.warning"),
  },
  syncing: {
    borderColor: token("color.border.information"),
  },
});

/**
 * Persistent offline/sync status ribbon — HCI mandate:
 *
 *   "Offline-First Cognitive Resilience: Field studies in East Africa prove
 *    that 'latency anxiety' causes users to refresh pages, leading to duplicate
 *    submissions or data loss."
 *
 * The ribbon appears only when the user is offline or syncing — it does NOT
 * appear when everything is fine, matching the exception-based dashboard
 * philosophy (never show "All Systems Green" — it becomes invisible noise).
 *
 * Uses Box backgroundColor prop (not xcss) for surface-aware background colour —
 * this is the canonical ADS compiled pattern confirmed in the mirror source.
 */
export function OfflineIndicator({
  status,
  testId,
}: OfflineIndicatorProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (status === "synced") return null;

  return (
    <Box
      backgroundColor={
        status === "offline"
          ? "color.background.warning"
          : "color.background.information"
      }
      xcss={cx(
        containerStyles['base'],
        status === "offline" ? containerStyles['offline'] : containerStyles['syncing'],
      )}
      {...(testId !== undefined ? { testId } : {})}
      role="status"
      aria-live="polite"
    >
      <Inline space="space.100" alignBlock="center">
        <span aria-hidden="true">{status === "offline" ? "⚠️" : "🔄"}</span>
        <Text
          size="small"
          weight="medium"
          color={
            status === "offline"
              ? "color.text.warning"
              : "color.text.information"
          }
        >
          {status === "offline" ? t("offline.banner") : t("offline.syncing")}
        </Text>
      </Inline>
    </Box>
  );
}
