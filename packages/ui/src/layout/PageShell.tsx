import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { PAGE_MAX_WIDTH, type PageAlign } from "../model.js";

const styles = cssMap({
  page: {
    marginInline: "auto",
    // 24px, the same inner padding NationalHeader uses; declared as a literal so
    // the tokens babel plugin can rewrite it.
    paddingInline: token("space.300"),
    paddingBlock: token("space.300"),
    // The page never lets the shell's grey page colour show through the column:
    // everything a route draws happens inside it.
    width: "100%",
    boxSizing: "border-box",
  },
  bleed: {
    marginInline: token("space.0"),
  },
});

const MAX_WIDTH_STYLE: Readonly<Record<PageAlign, string>> = {
  standard: PAGE_MAX_WIDTH.standard,
  header: PAGE_MAX_WIDTH.header,
  narrow: PAGE_MAX_WIDTH.narrow,
};

export interface PageShellProps {
  /**
   * Which column width the screen uses.
   *
   * - `header` (default): the national header's inner edge, so a page and the
   *   header lockup above it share a left margin at every viewport width.
   * - `standard`: the 1200px column six feature slices already ship.
   * - `narrow`: a reading-width column for forms and single-task screens.
   * - `bleed`: no cap. Use only for surfaces that own their own full-width
   *   layout (a board, a map); the padding still applies.
   */
  readonly align?: PageAlign | "bleed";
  /** The page's H1. Omit on screens whose heading is drawn by a wizard or a modal. */
  readonly title?: string;
  /** A line under the title that says what the page is for. */
  readonly description?: string;
  /** Right-aligned page actions - primary action, filters, refresh. */
  readonly actions?: React.ReactNode;
  /** Breadcrumb trail, rendered above the title. */
  readonly breadcrumbs?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly testId?: string;
}

/**
 * The one page column in USRP.
 *
 * Replaces the identical `root: { maxWidth: '1200px', marginInline: 'auto',
 * paddingBlock: token('space.300'), paddingInline: token('space.400') }` block
 * that was copied into ApplicationsPage, ApplicationDetailPage, campaigns'
 * shared.tsx, DpoQueuePage, QueuesPage and StaffPage, plus the console host's
 * slightly different copy in routes/dashboard.tsx.
 *
 * It is deliberately not a "layout" component: it draws no chrome. The shell
 * owns the frame (navigation, header, footer); this owns the column inside it.
 * Keeping those two separate is what lets the citizen portal, the console and
 * the field station share one column rule without sharing one shell.
 */
export function PageShell({
  align = "header",
  title,
  description,
  actions,
  breadcrumbs,
  children,
  testId,
}: PageShellProps): React.ReactElement {
  const capped = align !== "bleed";
  const maxWidth = capped ? MAX_WIDTH_STYLE[align] : undefined;
  return (
    <Box
      as="section"
      xcss={cx(styles['page'], capped ? undefined : styles['bleed'])}
      // The one dynamic dimension in the shell. A style attribute is correct
      // here and not a cssMap violation: the value is a constant from
      // PAGE_MAX_WIDTH, and compiled's static cssMap cannot take a variable
      // it has no class for.
      {...(maxWidth !== undefined ? { style: { maxWidth } } : {})}
      {...(testId !== undefined ? { testId } : {})}
    >
      <Stack space="space.400">
        {(breadcrumbs !== undefined || title !== undefined) && (
          <Stack space="space.150">
            {breadcrumbs !== undefined && <Box>{breadcrumbs}</Box>}
            {(title !== undefined || actions !== undefined) && (
              <Inline spread="space-between" alignBlock="end" shouldWrap space="space.300">
                <Box>
                  <Stack space="space.050">
                    {title !== undefined && <Heading size="large" as="h1">{title}</Heading>}
                    {description !== undefined && (
                      // size="large" is ADS's 16px body face: the design-system
                      // a11y floor (MIN_BODY_TEXT_PX) is 16, and the default
                      // `medium` is 14. The lead line is the first thing read.
                      <Text as="p" size="large" color="color.text.subtle">{description}</Text>
                    )}
                  </Stack>
                </Box>
                {actions !== undefined && <Inline space="space.100" alignBlock="center" shouldWrap>{actions}</Inline>}
              </Inline>
            )}
          </Stack>
        )}
        {children}
      </Stack>
    </Box>
  );
}
