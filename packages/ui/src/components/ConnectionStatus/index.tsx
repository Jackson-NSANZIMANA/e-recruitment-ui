import React, { useEffect, useState } from "react";
import SectionMessage from "@atlaskit/section-message";
import { Box, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

const styles = cssMap({
  wrapper: {
    paddingBlock: token("space.100"),
    paddingInline: token("space.200"),
  },
});

/**
 * Subscribe to browser connectivity.
 *
 * `navigator.onLine` is optimistic (it reports true behind a captive portal),
 * so the UI only ever claims "the device has no link", never "synced".
 */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const goOnline = (): void => { setOnline(true); };
    const goOffline = (): void => { setOnline(false); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

/**
 * The officer apps' offline banner (officer-console and field-station share it).
 *
 * It states the one honest fact: with no connection nothing is sent or saved.
 * It never promises a later sync — OFFLINE_CAPTURE_CAN_SYNC is false and no
 * write is queued or retried (AGENTS.md §2, ADR-FE-010). `aria-live` so losing
 * signal mid-task is announced without moving focus.
 */
export function ConnectionStatus(): React.ReactElement | null {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <Box xcss={styles.wrapper} role="status" aria-live="polite" testId="connection-offline">
      <SectionMessage appearance="warning" headingLevel="h2" title={t("offline.no_connection")}>
        <Text as="p">{t("offline.nothing_sent")}</Text>
      </SectionMessage>
    </Box>
  );
}
