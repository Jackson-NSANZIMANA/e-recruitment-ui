import React from "react";
import { Box, Inline } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { Agency } from "@usrp/contracts";
import { FlagRule } from "./FlagRule.js";
import { NationalLockup } from "./NationalLockup.js";

const styles = cssMap({
  header: {
    backgroundColor: token("elevation.surface"),
    position: "sticky",
    insetBlockStart: token("space.0"),
    zIndex: 100,
    // National chrome never yields height to content: in a column flex layout
    // a shrinkable header lets the next sibling paint over the flag ribbon.
    flexShrink: 0,
  },
  bar: {
    paddingInline: token("space.300"),
    paddingBlock: token("space.150"),
    maxWidth: "80rem",
    marginInline: "auto",
  },
  shadow: {
    borderBlockEndWidth: token("border.width"),
    borderBlockEndStyle: "solid",
    borderBlockEndColor: token("color.border"),
  },
});

interface NationalHeaderProps {
  readonly serviceName?: string;
  readonly agency?: Agency | null;
  readonly compact?: boolean;
  /** Right-hand tools: language switcher, account, sign-out. */
  readonly end?: React.ReactNode;
  /** Wraps the lockup, e.g. in a link to the service's home page. */
  readonly renderLockup?: (lockup: React.ReactElement) => React.ReactElement;
}

/**
 * The header every USRP surface opens with: the national lockup top-left, the
 * service's tools on the right, the tricolour underneath. Sticky, as RISA's
 * layout guideline requires for GoR sites, and wrapping on a phone instead of
 * hiding anything behind a menu - there are only ever three or four items.
 */
export function NationalHeader({ serviceName, agency = null, compact = false, end, renderLockup }: NationalHeaderProps): React.ReactElement {
  const lockup = (
    <NationalLockup
      agency={agency}
      compact={compact}
      {...(serviceName !== undefined ? { serviceName } : {})}
    />
  );
  return (
    <Box as="header" xcss={cx(styles['header'], styles['shadow'])}>
      <Box xcss={styles['bar']}>
        <Inline space="space.200" alignBlock="center" spread="space-between" shouldWrap>
          {renderLockup !== undefined ? renderLockup(lockup) : lockup}
          {end !== undefined && <Inline space="space.100" alignBlock="center" shouldWrap>{end}</Inline>}
        </Inline>
      </Box>
      <FlagRule />
    </Box>
  );
}
