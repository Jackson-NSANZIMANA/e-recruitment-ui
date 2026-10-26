import React from 'react';
import { Box } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';

interface MicrotextProps {
  /** The phrase repeated along the line. */
  readonly text: string;
  /** How many times to repeat it; long enough to overrun the widest container. */
  readonly repeat?: number;
  readonly testId?: string;
}

// Microprint reads as a hairline rule at normal viewing distance and as words
// only under magnification (or zoom). It is ornament, so it sits outside the
// 16px body-text floor and outside the accessibility tree. Drawn as SVG text so
// its 5-unit size is a presentation attribute of the drawing, not a CSS type
// style competing with the ADS type scale; the face is inherited from the page.
const styles = cssMap({
  line: {
    overflow: 'hidden',
    color: token('color.text.subtlest'),
    paddingBlockStart: token('space.075'),
    position: 'relative',
    userSelect: 'none',
  },
  svg: {
    // A flex container blockifies the inline <svg>, so it fills this box
    // instead of sitting on a text baseline below it (and being clipped).
    display: 'flex',
    position: 'absolute',
    insetBlockStart: token('space.0'),
    insetInlineStart: token('space.0'),
  },
});

/**
 * A line of microprinted text - the "rule" under a passport's title that turns
 * out to be the country's name repeated a thousand times.
 */
export function Microtext({ text, repeat = 60, testId }: MicrotextProps): React.ReactElement {
  const phrase = `${text.toUpperCase()} · `;
  return (
    <Box xcss={styles['line']} aria-hidden {...(testId !== undefined ? { testId } : {})}>
      <Box xcss={styles['svg']}>
        <svg width="4000" height="6" focusable="false">
          <text x="0" y="5" fontSize="5" letterSpacing="0.4" fill="currentColor">
            {phrase.repeat(repeat)}
          </text>
        </svg>
      </Box>
    </Box>
  );
}
