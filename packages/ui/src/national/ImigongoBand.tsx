import React from "react";
import { Box } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  band: {
    position: "relative",
    paddingBlockStart: token("space.300"),
    overflow: "hidden",
    color: token("color.text.subtlest"),
  },
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

interface ImigongoBandProps {
  readonly testId?: string;
}

/**
 * A band of Imigongo - the geometric art of Rwanda's Eastern Province, the same
 * art the Rwandan e-passport carries and the pattern family RISA's GoR
 * websites guideline prescribes "as subtle background textures or decorative
 * borders" that "should not overpower the content".
 *
 * So it is quiet on purpose: one neutral border token, nested chevrons and a
 * diamond, repeated. Never behind text, never in colour.
 */
export function ImigongoBand({ testId }: ImigongoBandProps): React.ReactElement {
  const id = React.useId().replace(/:/g, "");
  return (
    <Box xcss={styles['band']} aria-hidden {...(testId !== undefined ? { testId } : {})}>
      <Box xcss={styles['fill']}>
        <svg width="100%" height="100%" focusable="false">
          <defs>
            <pattern id={`imigongo-${id}`} width="48" height="24" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeLinejoin="miter">
                <path d="M0 24 L12 12 L24 24 L36 12 L48 24" />
                <path d="M0 18 L12 6 L24 18 L36 6 L48 18" />
                <path d="M0 12 L12 0 L24 12 L36 0 L48 12" />
                <path d="M24 2 L30 8 L24 14 L18 8 Z" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#imigongo-${id})`} />
        </svg>
      </Box>
    </Box>
  );
}
