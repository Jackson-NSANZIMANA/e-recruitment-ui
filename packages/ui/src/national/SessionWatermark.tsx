import React, { useEffect, useState } from "react";
import { Box } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  layer: {
    // A flex container blockifies the inline <svg>, so it fills this box
    // instead of sitting on a text baseline below it (and being clipped).
    display: "flex",
    position: "fixed",
    insetBlockStart: token("space.0"),
    insetBlockEnd: token("space.0"),
    insetInlineStart: token("space.0"),
    insetInlineEnd: token("space.0"),
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 400,
    color: token("color.text"),
    userSelect: "none",
  },
});

interface SessionWatermarkProps {
  /** The handling marking, e.g. "RESTRICTED". */
  readonly marking: string;
  /** Agency of the server-side session. */
  readonly agency: string;
}

const MINUTE = 60_000;

function stamp(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${String(now.getFullYear())}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
}

/**
 * A faint, tiled stamp of the handling marking, the agency and the current
 * minute over every staff screen - the forensic watermark printed on a
 * classified copy.
 *
 * It deters nothing technically (a determined person can crop it). It makes a
 * photograph or screenshot of applicant data traceable: agency and minute,
 * matched against the audit trail, narrow it to the officers who were working
 * then. It deliberately does NOT print an officer identifier: the edge
 * forbids `officerId` in browser payloads, and adding one is a contract
 * decision, not a styling one (ADR-FE-020 §open questions).
 *
 * Faint enough to read through, never interactive, invisible to assistive
 * technology, and never contains applicant data.
 */
export function SessionWatermark({ marking, agency }: SessionWatermarkProps): React.ReactElement {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), MINUTE);
    return () => window.clearInterval(id);
  }, []);

  const text = [marking, agency, stamp(now)].join(" · ");
  // Enough tiles to cover a 2560x1600 viewport after the -24° rotation, which
  // swings the grid's corners outside the screen.
  const rows = Array.from({ length: 24 }, (_, row) => row);
  const cols = Array.from({ length: 10 }, (_, col) => col);

  return (
    <Box xcss={styles['layer']} aria-hidden testId="session-watermark">
      <svg width="100%" height="100%" focusable="false">
        <g fill="currentColor" fillOpacity="0.05" fontSize="14" transform="rotate(-24)">
          {rows.flatMap((row) =>
            cols.map((col) => (
              <text key={`${String(row)}-${String(col)}`} x={col * 360 - 900 + (row % 2) * 180} y={row * 110 - 200}>
                {text}
              </text>
            )),
          )}
        </g>
      </svg>
    </Box>
  );
}
