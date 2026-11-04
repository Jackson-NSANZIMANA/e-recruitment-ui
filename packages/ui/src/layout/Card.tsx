import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  base: {
    // The card is a RAISED plane, and a raised plane in ADS is a PAIR: a surface
    // token and a shadow token. Taking only the surface was the bug this
    // component shipped with - in atlassian-light `elevation.surface.raised`
    // resolves to #FFFFFF, exactly `elevation.surface`, so on a white page the
    // "raised" card was a 1px border and nothing else. The shadow is what
    // actually lifts it, and `elevation.shadow.raised` is one hairline shadow
    // plus a 1px ambient line - the same subtle lift Jira uses on its cards.
    backgroundColor: token("elevation.surface.raised"),
    boxShadow: token("elevation.shadow.raised"),
    borderRadius: token("radius.medium"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    padding: token("space.300"),
    // Position + a radius make the shadow's overflow visible without clipping
    // the children's focus rings.
    position: "relative",
    // Fill the grid cell it sits in, so a row of cards is one height. In a block
    // flow (auto-height parent) this resolves to auto and changes nothing.
    height: "100%",
    boxSizing: "border-box",
  },
  flat: {
    backgroundColor: token("elevation.surface"),
    // A flat card is not elevated, so it must not cast: the pairing is dropped
    // together with the surface, never half-kept.
    boxShadow: "initial",
  },
  /** Tighter padding for tiles and short cards that sit in a row of their own. */
  compact: { padding: token("space.200") },
  selected: {
    // The selected-card treatment from the Jira template picker: a brand
    // border on a brand-tinted surface, so selection is visible without
    // relying on a checkmark alone.
    borderColor: token("color.border.brand"),
    backgroundColor: token("color.background.brand.subtlest"),
  },
  header: { minWidth: "0" },
  actions: { flexShrink: 0 },
  footer: {
    paddingBlockStart: token("space.200"),
    borderBlockStartWidth: token("border.width"),
    borderBlockStartStyle: "solid",
    borderBlockStartColor: token("color.border"),
  },
});

export type CardTone = "raised" | "flat";

export interface CardProps {
  /** Card heading. Rendered as an accessible label for the region. */
  readonly title?: string;
  /** The heading level the title occupies in the page outline. */
  readonly titleLevel?: 2 | 3 | 4;
  /** A one-line lead under the title. */
  readonly description?: string;
  /** Right-hand controls: a menu, a refresh, a "View all" link. */
  readonly actions?: React.ReactNode;
  /** A footer row separated by a rule - totals, pagination, a primary action. */
  readonly footer?: React.ReactNode;
  /** `raised` (default) draws a card surface; `flat` draws a panel with no fill change. */
  readonly tone?: CardTone;
  /** Tighter padding, for tiles in a row of their own. */
  readonly density?: "default" | "compact";
  /** Highlight the card as the current selection. */
  readonly selected?: boolean;
  readonly children?: React.ReactNode;
  readonly testId?: string;
}

/**
 * A bordered, titled region — the unit of layout on every dashboard and queue
 * screen.
 *
 * This is the component the officer console was missing rather than a new look:
 * `apps/officer-console/src/dashboard/panels.tsx` and
 * `DashboardMetricCard` had each grown their own copy of the panel `cssMap`,
 * and they disagreed about the surface. Both now delegate here.
 *
 * Accessibility: when a `title` is given the card becomes a named `<section>`,
 * so a screen reader user can jump between panels. Without a title it is an
 * unnamed box, which is correct for a bare container and wrong for a panel -
 * hence `title` being encouraged rather than optional in review.
 */
export function Card({
  title,
  titleLevel = 2,
  description,
  actions,
  footer,
  tone = "raised",
  density = "default",
  selected = false,
  children,
  testId,
}: CardProps): React.ReactElement {
  const id = React.useId();
  const headingId = `${id}-title`;

  // No testId here, ever: the element that owns the testId is the outermost one
  // (the <section> when titled, the <Box> otherwise). Putting it on both would
  // make every `getByTestId` in the console e2e suite match two nodes.
  const body = (
    <Stack space="space.200">
      {(title !== undefined || actions !== undefined) && (
        <Inline spread="space-between" alignBlock="start" space="space.200" shouldWrap>
          <Box xcss={styles['header']}>
            <Stack space="space.050">
              {title !== undefined && (
                <Heading size="small" as={`h${String(titleLevel)}` as "h2" | "h3" | "h4"} id={headingId}>
                  {title}
                </Heading>
              )}
              {description !== undefined && (
                <Text as="p" size="large" color="color.text.subtle">{description}</Text>
              )}
            </Stack>
          </Box>
          {actions !== undefined && <Box xcss={styles['actions']}>{actions}</Box>}
        </Inline>
      )}
      {children}
      {footer !== undefined && <Box xcss={styles['footer']}>{footer}</Box>}
    </Stack>
  );

  // No `onClick`. A card that is a control must contain a real `<button>` or
  // `<a>`: a div with a click handler is not focusable, does not answer Enter or
  // Space, and announces nothing. The earlier version accepted `onClick`,
  // styled a hover state, and never attached a handler - a trap that would have
  // shipped a card that looked clickable and was not. Callers put the control in
  // `children` or `footer` and let it carry the interaction.
  if (title !== undefined) {
    return (
      <section aria-labelledby={headingId} {...(testId !== undefined ? { "data-testid": testId } : {})}>
        <Box
          xcss={cx(
            styles['base'],
            density === "compact" ? styles['compact'] : undefined,
            tone === "flat" ? styles['flat'] : undefined,
            selected ? styles['selected'] : undefined,
          )}
        >
          {body}
        </Box>
      </section>
    );
  }
  return (
    <Box
      xcss={cx(
        styles['base'],
        density === "compact" ? styles['compact'] : undefined,
        tone === "flat" ? styles['flat'] : undefined,
        selected ? styles['selected'] : undefined,
      )}
      {...(testId !== undefined ? { testId } : {})}
    >
      {body}
    </Box>
  );
}
