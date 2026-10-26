import React from "react";
import { Box } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { FLAG_RIBBON, NATIONAL_COLOURS } from "./identity.js";

const styles = cssMap({
  // Height comes from padding tokens, not a height literal: the rule is
  // decoration, and the 48px touch-target gate should never have to reason
  // about it.
  thin: { position: "relative", paddingBlockStart: token("space.050"), overflow: "hidden" },
  thick: { position: "relative", paddingBlockStart: token("space.100"), overflow: "hidden" },
  fill: {
    // A flex container blockifies the inline <svg>, so it fills this box
    // instead of sitting on a text baseline below it (and being clipped).
    display: "flex",
    position: "absolute",
    insetBlockStart: token("space.0"),
    insetInlineStart: token("space.0"),
    insetInlineEnd: token("space.0"),
    insetBlockEnd: token("space.0"),
  },
});

interface FlagRuleProps {
  readonly weight?: "thin" | "thick";
  readonly testId?: string;
}

const TOTAL = FLAG_RIBBON.reduce((sum, band) => sum + band.share, 0);

/**
 * The national tricolour as a ribbon - blue, yellow, green in the flag's own
 * proportions - drawn under the header and over the footer of every surface.
 *
 * Drawn in SVG with the statutory colours from identity.ts (ADR-FE-020): this
 * is a national symbol, so it does not take a theme's approximation of it.
 */
export function FlagRule({ weight = "thin", testId }: FlagRuleProps): React.ReactElement {
  let x = 0;
  return (
    <Box xcss={weight === "thick" ? styles['thick'] : styles['thin']} aria-hidden {...(testId !== undefined ? { testId } : {})}>
      <Box xcss={styles['fill']}>
        <svg viewBox={`0 0 ${String(TOTAL)} 1`} preserveAspectRatio="none" width="100%" height="100%" focusable="false">
          {FLAG_RIBBON.map((band) => {
            const rect = <rect key={band.colour} x={x} y={0} width={band.share} height={1} fill={NATIONAL_COLOURS[band.colour]} />;
            x += band.share;
            return rect;
          })}
        </svg>
      </Box>
    </Box>
  );
}
