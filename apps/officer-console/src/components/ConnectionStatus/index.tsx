import React, { useEffect, useState } from "react";
import SectionMessage from "@atlaskit/section-message";
import { Box, Stack } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

const styles = cssMap({
  wrapper: {
    paddingTop: token("space.100"),
    paddingRight: token("space.200"),
    paddingBottom: token("space.100"),
    paddingLeft: token("space.200"),
  },
});

/**
 * Subscribe to browser connectivity.
 *
 * `navigator.onLine` alone is famously optimistic - it reports true for a
 * captive portal or a venue wifi with no upstream - so this is deliberately
 * described in the UI as connectivity, never as "synced". The honest claim a
 * browser can make is "the OS says there is no link", and that is the only claim
 * made here.
 */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

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
 * The field tablet's connection state, and the limitation behind it.
 *
 * TWO messages, because they are two different facts and conflating them is how
 * an officer loses an afternoon:
 *
 *  1. "You are offline" - a transient device condition.
 *  2. "Captures stay on this device" - a STANDING architectural limitation.
 *     POST /v1/field-sync/scores is implemented upstream but no /edge/v1 route
 *     brokers it, so OFFLINE_CAPTURE_CAN_SYNC is false in the field-ops slice.
 *     ADR-FE-005 requires an honest unavailable state rather than a blank or
 *     hopeful one, for exactly the reason it gives about SLOT_ASSIGNED: the
 *     person who most needs the answer reads silence as a system fault.
 *
 * `aria-live="polite"` because losing signal mid-capture is a state change an
 * officer must learn about without watching a corner of the screen.
 */
export function ConnectionStatus(): React.ReactElement | null {
  const { t } = useTranslation();
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <Box xcss={styles.wrapper} role="status" aria-live="polite">
      <SectionMessage appearance="warning" headingLevel={2} title={t("offline.banner")}>
        <Stack space="space.050">
          <span>{t("offline.sync_unavailable")}</span>
        </Stack>
      </SectionMessage>
    </Box>
  );
}
