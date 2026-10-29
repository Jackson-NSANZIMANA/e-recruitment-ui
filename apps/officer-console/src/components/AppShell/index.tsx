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
import { useTranslation } from "@usrp/i18n";

import { useOfficerSession } from "@usrp/auth";
import { CoatOfArms, ConnectionStatus, HandlingMarking, LanguageSwitcher, NationalLockup, SandboxBanner, SessionWatermark, isSandboxBuild } from "@usrp/ui";
import { navItemsFor, type NavItem } from "../../nav.js";

const NAV_ICONS: Readonly<Record<NavItem["id"], React.ReactElement>> = {
  dashboard: <DashboardIcon label="" color="currentColor" />,
  applications: <AppsIcon label="" color="currentColor" />,
  queues: <ChecklistIcon label="" color="currentColor" />,
  campaigns: <MegaphoneIcon label="" color="currentColor" />,
  erasure: <DeleteIcon label="" color="currentColor" />,
  staff: <LockIcon label="" color="currentColor" />,
};

// The top bar's logo slot takes a logo and an icon component (ADS CustomLogo).
// The lockup replaces the Atlassian product mark this console shipped with: a
// Government of Rwanda tool identifies the Republic of Rwanda, not its UI kit.
function ConsoleLogo(): React.ReactElement {
  const session = useOfficerSession();
  return <NationalLockup compact agency={session?.agency ?? null} />;
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
  // The venue gate and the walk-in desk left this menu in S02: they run on the
  // Field Station (ADR-FE-007); /gate and /walk-in redirect to a notice.

  return (
    <Root>
      {/* Handling marking: every staff screen states its restriction (ADR-FE-020). */}
      <Banner height={isSandboxBuild() ? 64 : 32}>
        {/* ADR-FE-019: a sandbox build says so above everything else. */}
        {isSandboxBuild() ? <SandboxBanner /> : null}
        <HandlingMarking />
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

      <SideNav label={t("a11y.open_menu")}>
        <SideNavBody>
          <MenuList>
            {items.map((item) => (
              <LinkMenuItem key={item.id} href={item.href} elemBefore={NAV_ICONS[item.id]}>
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
