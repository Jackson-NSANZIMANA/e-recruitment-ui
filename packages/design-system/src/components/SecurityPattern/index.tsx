import React, { useMemo } from 'react';
import { Box } from '@atlaskit/primitives/compiled';
import { cssMap, cx } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';
import { bandPaths, rosettePaths, seedFrom } from '../../security-print/guilloche.js';

export type SecurityPatternVariant = 'band' | 'rosette';
export type SecurityPatternTone = 'brand' | 'neutral';

interface SecurityPatternProps {
  /** Any stable string - a document serial or processing code. Same seed, same pattern. */
  readonly seed: string;
  readonly variant?: SecurityPatternVariant;
  readonly tone?: SecurityPatternTone;
  readonly testId?: string;
}

// The pattern fills its positioned parent and never takes a pointer event or a
// focus stop. Line colour flows in through `color` (a token) and the SVG draws
// with currentColor, so no colour value is written into the markup. Its
// faintness is the SVG's own stroke-opacity: a property of the drawing, not a
// UI opacity state (which is all the ADS opacity tokens describe).
const styles = cssMap({
  layer: {
    // A flex container blockifies the inline <svg>, so it fills this box
    // instead of sitting on a text baseline below it (and being clipped).
    display: 'flex',
    position: 'absolute',
    insetBlockStart: token('space.0'),
    insetBlockEnd: token('space.0'),
    insetInlineStart: token('space.0'),
    insetInlineEnd: token('space.0'),
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  brand: { color: token('color.text.brand') },
  neutral: { color: token('color.text.subtlest') },
});

const VIEW_W = 600;
const VIEW_H = 360;
const LINE_OPACITY = 0.2;

/**
 * Seeded guilloche line-work for the background of an official document.
 *
 * Decorative by definition: aria-hidden, no role, no text. Its job is the one
 * a passport's background print does - make a genuine document look like one,
 * and make every issued document look slightly different from every other.
 * See security-print/guilloche.ts for why it is seeded.
 */
export function SecurityPattern({
  seed,
  variant = 'band',
  tone = 'brand',
  testId,
}: SecurityPatternProps): React.ReactElement {
  const paths = useMemo(() => {
    const n = seedFrom(seed);
    return variant === 'rosette'
      ? rosettePaths({ seed: n, cx: VIEW_W / 2, cy: VIEW_H / 2, radius: VIEW_H * 0.46 })
      : bandPaths({ seed: n, width: VIEW_W, height: VIEW_H });
  }, [seed, variant]);

  return (
    <Box
      xcss={cx(styles['layer'], tone === 'brand' ? styles['brand'] : styles['neutral'])}
      aria-hidden
      {...(testId !== undefined ? { testId } : {})}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeOpacity={LINE_OPACITY} strokeWidth={0.5} vectorEffect="non-scaling-stroke">
          {paths.map((d, i) => (
            <path key={`${variant}-${String(i)}`} d={d} />
          ))}
        </g>
      </svg>
    </Box>
  );
}
