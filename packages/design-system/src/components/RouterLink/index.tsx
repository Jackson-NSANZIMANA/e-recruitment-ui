import React from 'react';
import { Link } from 'react-router-dom';
import type {
  RouterLinkComponent,
  RouterLinkComponentProps,
} from '@atlaskit/app-provider/router-link-provider';

/**
 * Adapts react-router-dom's Link to the ADS RouterLinkComponent contract.
 *
 * Wired once into AppProvider.routerLinkComponent, after which every ADS
 * component that accepts an `href` navigates client-side automatically. That is
 * the whole reason this belongs in the domain-free layer: it is plumbing
 * between two libraries, and it knows nothing about what any route means.
 *
 * Absolute http(s) URLs fall through to a plain anchor, with rel/target set so
 * an external destination cannot reach back through window.opener. Detection is
 * an anchored regex rather than startsWith('http') - the latter also matches a
 * relative path beginning "httpfoo", which would silently stop routing.
 */
export const RouterLink: RouterLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  RouterLinkComponentProps
>(({ href, children, ...rest }, ref) =>
  /^https?:\/\//i.test(href) ? (
    // eslint-disable-next-line @atlaskit/design-system/no-html-anchor -- external-URL adapter; ADS Anchor targets internal routes only
    <a ref={ref} href={href} rel="noreferrer noopener" target="_blank" {...rest}>
      {children}
    </a>
  ) : (
    <Link to={href} ref={ref as React.Ref<HTMLAnchorElement>} {...rest}>
      {children}
    </Link>
  ),
);

RouterLink.displayName = 'RouterLink';
