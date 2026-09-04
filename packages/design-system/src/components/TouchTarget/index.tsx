import React from 'react';
import { Box } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';
import { MIN_TOUCH_TARGET_PX } from '../../a11y/index.js';

interface TouchTargetProps {
  readonly children: React.ReactNode;
  /** Centres the child within the enlarged hit area. Defaults to true. */
  readonly center?: boolean;
  readonly testId?: string;
}

/**
 * Guarantees a 48x48 CSS-pixel minimum hit area around a smaller visual control.
 *
 * The problem it solves: an icon button is often 24px of glyph, and a 24px
 * target is a miss-tap for a user standing in a queue in the sun holding a
 * cheap phone one-handed. Padding the icon itself would change how it looks;
 * this wraps it, so the visual stays and the target grows.
 *
 * The floor comes from src/a11y - one constant, imported by the component,
 * asserted by the unit tests, and enforced by the usrp/min-touch-target lint
 * rule. Three consumers, one number, no way for them to drift apart.
 *
 * cssMap lives at module scope because @compiled must be able to extract it at
 * build time; the values are literals for the same reason.
 */
const styles = cssMap({
  base: {
    minWidth: '48px',
    minHeight: '48px',
  },
  centered: {
    minWidth: '48px',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function TouchTarget({
  children,
  center = true,
  testId,
}: TouchTargetProps): React.ReactElement {
  return (
    <Box
      xcss={center ? styles['centered'] : styles['base']}
      {...(testId !== undefined ? { testId } : {})}
    >
      {children}
    </Box>
  );
}

/** Re-exported so a consumer can assert against the same number. */
export { MIN_TOUCH_TARGET_PX };
