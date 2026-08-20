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
 */
export function AppShell({ children }: AppShellProps): React.ReactElement {
  return (
    <Root>
      <TopNav>
        <TopNavStart
          sideNavToggleButton={
            <SideNavToggleButton
              collapseLabel="Collapse navigation"
              expandLabel="Expand navigation"
            />
          }
        >
          <AppLogo
            href="/dashboard"
            name="USRP Officer Console"
            label="Go to dashboard"
            icon={AdminIcon}
          />
        </TopNavStart>
        <TopNavEnd>
          <Profile label="Account" />
        </TopNavEnd>
      </TopNav>

      <SideNav label="Officer Console navigation">
        <SideNavBody>
          <MenuList>
            <LinkMenuItem
              href="/dashboard"
              elemBefore={<DashboardIcon label="" color="currentColor" />}
            >
              Dashboard
            </LinkMenuItem>
            <LinkMenuItem
              href="/applications"
              elemBefore={<AppsIcon label="" color="currentColor" />}
            >
              Applications
            </LinkMenuItem>
            <LinkMenuItem
              href="/walk-in"
              elemBefore={<PersonAddIcon label="" color="currentColor" />}
            >
              Walk-in
            </LinkMenuItem>
          </MenuList>
        </SideNavBody>
      </SideNav>

      <Main>{children}</Main>
    </Root>
  );
}
