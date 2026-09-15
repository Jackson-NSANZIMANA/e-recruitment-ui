import React from "react";
import { Root } from "@atlaskit/navigation-system/layout/root";
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
  AppLogo,
  Profile,
} from "@atlaskit/navigation-system/top-nav-items";
import { AdminIcon } from "@atlaskit/logo";
import { LinkMenuItem } from "@atlaskit/side-nav-items/link-menu-item";
import { MenuList } from "@atlaskit/side-nav-items/menu-list";
import DashboardIcon from "@atlaskit/icon/core/dashboard";
import AppsIcon from "@atlaskit/icon/core/apps";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import { useTranslation } from "@usrp/i18n";

import { ConnectionStatus } from "../ConnectionStatus/index.js";

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
  const { t } = useTranslation();

  return (
    <Root>
      <TopNav>
        <TopNavStart
          sideNavToggleButton={
            <SideNavToggleButton
              collapseLabel={t("a11y.collapse_nav")}
              expandLabel={t("a11y.expand_nav")}
            />
          }
        >
          <AppLogo
            href="/dashboard"
            name={t("dashboard.title")}
            label={t("nav.dashboard")}
            icon={AdminIcon}
          />
        </TopNavStart>
        <TopNavEnd>
          <Profile label={t("nav.settings")} />
        </TopNavEnd>
      </TopNav>

      <SideNav label={t("a11y.open_menu")}>
        <SideNavBody>
          <MenuList>
            <LinkMenuItem
              href="/dashboard"
              elemBefore={<DashboardIcon label="" color="currentColor" />}
            >
              {t("nav.dashboard")}
            </LinkMenuItem>
            <LinkMenuItem
              href="/applications"
              elemBefore={<AppsIcon label="" color="currentColor" />}
            >
              {t("nav.applications")}
            </LinkMenuItem>
            <LinkMenuItem
              href="/walk-in"
              elemBefore={<PersonAddIcon label="" color="currentColor" />}
            >
              {t("nav.walk_in")}
            </LinkMenuItem>
          </MenuList>
        </SideNavBody>
      </SideNav>

      <Main>
        <ConnectionStatus />
        {children}
      </Main>
    </Root>
  );
}
