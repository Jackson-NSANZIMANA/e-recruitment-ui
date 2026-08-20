import React from "react";
import { Link } from "react-router-dom";
import type {
  RouterLinkComponent,
  RouterLinkComponentProps,
} from "@atlaskit/app-provider/router-link-provider";

/**
 * Adapts react-router-dom's <Link> to the ADS RouterLinkComponent contract.
 * Wired into AppProvider.routerLinkComponent so every ADS component that
 * accepts an `href` prop (Button, etc.) uses client-side navigation automatically.
 *
 * External URLs (http/https) fall through to a plain <a> tag.
 */
export const RouterLink: RouterLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  RouterLinkComponentProps
>(({ href, children }, ref) =>
  href.startsWith("http") ? (
    // eslint-disable-next-line @atlaskit/design-system/no-html-anchor -- external URL adapter; ADS Anchor only handles internal routes
    <a ref={ref} href={href}>
      {children}
    </a>
  ) : (
    <Link to={href} ref={ref as React.Ref<HTMLAnchorElement>}>
      {children}
    </Link>
  ),
);

RouterLink.displayName = "RouterLink";
