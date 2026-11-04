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
 * EVERY OTHER PROP IS FORWARDED (className, onClick, aria-*, data-*, style...).
 * ADS styles and wires its anchors through them: in the side nav the anchor's
 * className is what stretches it over the whole row. An adapter that keeps only
 * href and children leaves a bare <a>, a neighbouring row's decorative overlay
 * sits on top of it, and the click never reaches the link.
 *
 * External URLs (http/https) fall through to a plain <a> tag.
 */
export const RouterLink: RouterLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  RouterLinkComponentProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">
>(({ href, children, ...rest }, ref) =>
  href.startsWith("http") ? (
    // eslint-disable-next-line @atlaskit/design-system/no-html-anchor -- external URL adapter; ADS Anchor only handles internal routes
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={href} ref={ref as React.Ref<HTMLAnchorElement>} {...rest}>
      {children}
    </Link>
  ),
);

RouterLink.displayName = "RouterLink";
