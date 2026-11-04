import React from "react";
import { Root } from "@atlaskit/navigation-system/layout/root";
import { Banner } from "@atlaskit/navigation-system/layout/banner";
import {
  TopNav,
  TopNavStart,
  TopNavEnd,
} from "@atlaskit/navigation-system/layout/top-nav";
import {
  SideNav,
  SideNavBody,
  SideNavToggleButton,
} from "@atlaskit/navigation-system/layout/side-nav";
import { Main } from "@atlaskit/navigation-system/layout/main";
import {
  CustomLogo,
  Profile,
} from "@atlaskit/navigation-system/top-nav-items";
import { LinkMenuItem } from "@atlaskit/side-nav-items/link-menu-item";
import { MenuList } from "@atlaskit/side-nav-items/menu-list";
import DashboardIcon from "@atlaskit/icon/core/dashboard";
import AppsIcon from "@atlaskit/icon/core/apps";
import ChecklistIcon from "@atlaskit/icon/core/list-checklist";
import DeleteIcon from "@atlaskit/icon/core/delete";
import LockIcon from "@atlaskit/icon/core/lock-locked";
import MegaphoneIcon from "@atlaskit/icon/core/megaphone";
import ChartIcon from "@atlaskit/icon/core/chart-bar";
import { Box } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useLocation } from "react-router-dom";
import { useTranslation } from "@usrp/i18n";

import { useOfficerSession } from "@usrp/auth";
import { CoatOfArms, ConnectionStatus, HandlingMarking, LanguageSwitcher, NationalLockup, SandboxBanner, SessionWatermark, isSandboxBuild } from "@usrp/ui";
import { navItemsFor, type NavItem } from "../../nav.js";

const NAV_ICONS: Readonly<Record<NavItem["id"], React.ReactElement>> = {
  dashboard: <DashboardIcon label="" color="currentColor" />,
  applications: <AppsIcon label="" color="currentColor" />,
  queues: <ChecklistIcon label="" color="currentColor" />,
  campaigns: <MegaphoneIcon label="" color="currentColor" />,
  analytics: <ChartIcon label="" color="currentColor" />,
  erasure: <DeleteIcon label="" color="currentColor" />,
  staff: <LockIcon label="" color="currentColor" />,
};

/**
 * The brand rail.
 *
 * A 4px brand-coloured line directly under the top navigation. It is the
 * cheapest "designed by someone" signal available: ADS uses the same device to
 * separate product chrome from page content, and it gives the header a bottom
 * edge without adding a second border colour to the page. Colour comes from
 * `color.border.brand.bold`, so it is a token like everything else.
 */
const RAIL = cssMap({
  rail: {
    // Drawn as a border, not a 4px box: a box that thin reads to the 48px
    // interactive-floor rule as a shrunken control, and a decorative line is not
    // a control. `border.width.selected` is 2px, doubled by the token's own job
    // (a selected edge), so this is a 4px brand edge with no box at all.
    borderBlockEndWidth: token("border.width.selected"),
    borderBlockEndStyle: "solid",
    borderBlockEndColor: token("color.border.brand"),
    boxSizing: "border-box",
  },
});

/**
 * The banner's two bars (SANDBOX above RESTRICTED) share its fixed height. A flex
 * column lets each take an equal half; without it the marking overflowed the
 * Banner and the top navigation covered its lower half.
 */
const BANNER_STACK = cssMap({
  stack: { display: "flex", flexDirection: "column", blockSize: "100%" },
  // Each bar gets an equal share. The wrapper is a one-cell grid, so the bar
  // inside stretches to the full share, width and height, without the bar knowing about the Banner.
  half: { display: "grid", flexGrow: 1, flexShrink: 1, flexBasis: 0, minBlockSize: 0, overflow: "hidden" },
});

// The top bar's logo slot takes a logo and an icon component (ADS CustomLogo).
// The lockup replaces the Atlassian product mark this console shipped with: a
// Government of Rwanda tool identifies the Republic of Rwanda, not its UI kit.
//
// ADS draws the logo slot as a link (underlined) and expects an SVG inside it. This
// lockup is TEXT, and a link's text-decoration propagates into every in-flow
// descendant, so the names showed underlined. A text-decoration cannot be undone by a
// descendant, but an atomic inline box (inline-block) does not receive it; the outer
// Box absorbs the slot's flex blockification so the inner span stays inline-block.
const LOGO = cssMap({
  inner: { display: "inline-block" },
});
function ConsoleLogo(): React.ReactElement {
  const session = useOfficerSession();
  return (
    <Box>
      <Box as="span" xcss={LOGO["inner"]}>
        <NationalLockup compact agency={session?.agency ?? null} />
      </Box>
    </Box>
  );
}
function ConsoleIcon(): React.ReactElement {
  return <CoatOfArms height={28} alt="" />;
}

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Officer Console application shell.
 *
 * Uses @atlaskit/navigation-system — the current (non-deprecated) ADS
 * navigation package. Provides:
 *  - Responsive CSS Grid layout (auto-collapses on tablets/mobile)
 *  - Collapsible side nav with keyboard shortcut
 *  - TopNav with agency branding and profile slot
 *  - Built-in skip links (WCAG 2.4.1)
 *  - Links route through routerLinkComponent (wired in main.tsx via AppProvider)
 *
 * EVERY STRING IS TRANSLATED, as of 2026-09-13. They were hardcoded English
 * while index.html declared `lang="rw"`, which is WCAG 3.1.1 (Language of Page)
 * failing in the most literal way available: a screen reader applying
 * Kinyarwanda pronunciation rules to the word "Dashboard". The keys used here
 * (`nav.*`) already existed in all three locale bundles at full parity, so this
 * was a wiring gap, not a translation gap.
 */
export function AppShell({ children }: AppShellProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const session = useOfficerSession();
  const items = navItemsFor(session?.permissions ?? []);
  const { pathname } = useLocation();
  // The venue gate and the walk-in desk left this menu in S02: they run on the
  // Field Station (ADR-FE-007); /gate and /walk-in redirect to a notice.

  return (
    <Root>
      {/* Handling marking: every staff screen states its restriction (ADR-FE-020). */}
      <Banner height={isSandboxBuild() ? 64 : 32}>
        <Box xcss={BANNER_STACK["stack"]}>
          {/* ADR-FE-019: a sandbox build says so above everything else. */}
          {isSandboxBuild() ? <Box xcss={BANNER_STACK["half"]}><SandboxBanner /></Box> : null}
          <Box xcss={BANNER_STACK["half"]}><HandlingMarking /></Box>
        </Box>
      </Banner>
      <TopNav>
        <TopNavStart
          sideNavToggleButton={
            <SideNavToggleButton
              collapseLabel={t("a11y.collapse_nav")}
              expandLabel={t("a11y.expand_nav")}
            />
          }
        >
          <CustomLogo
            href="/dashboard"
            label={t("nav.dashboard")}
            logo={ConsoleLogo}
            icon={ConsoleIcon}
          />
        </TopNavStart>
        <TopNavEnd>
          <LanguageSwitcher />
          <Profile label={t("nav.settings")} />
        </TopNavEnd>
      </TopNav>
      <Box xcss={RAIL['rail']} aria-hidden="true" />

      <SideNav label={t("a11y.open_menu")}>
        <SideNavBody>
          <MenuList>
            {items.map((item) => (
              <LinkMenuItem key={item.id} href={item.href} isSelected={pathname === item.href || pathname.startsWith(`${item.href}/`)} elemBefore={NAV_ICONS[item.id]}>
                {t(item.labelKey)}
              </LinkMenuItem>
            ))}
          </MenuList>
        </SideNavBody>
      </SideNav>

      <Main>
        <ConnectionStatus />
        {children}
        {session !== null && (
          <SessionWatermark marking={t("national.restricted").toLocaleUpperCase(i18n.language)} agency={session.agency} />
        )}
      </Main>
    </Root>
  );
}
