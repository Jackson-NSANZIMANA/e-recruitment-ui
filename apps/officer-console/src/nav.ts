// ══════════════════════════════════════════════════════════════════
// officer-console — permission-built navigation (S06). Pure.
//
// The menu is built from the session view's `permissions`, never from a role
// name: an item appears only when the post behind it holds the permission that
// the item's screens need. A route typed by hand into the address bar renders
// the forbidden state, not an empty screen (each slice checks its own permission).
// ══════════════════════════════════════════════════════════════════

export interface NavItem {
  readonly id: 'dashboard' | 'applications' | 'queues' | 'campaigns' | 'erasure' | 'staff';
  readonly href: string;
  readonly labelKey: string;
}

const ITEMS: readonly (NavItem & { readonly needs: string | null })[] = [
  { id: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', needs: null },
  { id: 'applications', href: '/applications', labelKey: 'nav.applications', needs: 'application.read' },
  { id: 'queues', href: '/adjudication', labelKey: 'nav.queues', needs: 'adjudication.read' },
  { id: 'campaigns', href: '/campaigns', labelKey: 'nav.campaigns', needs: 'campaign.read.admin' },
  { id: 'erasure', href: '/compliance/erasure-queue', labelKey: 'nav.erasure', needs: 'erasure.queue.read' },
  { id: 'staff', href: '/staff', labelKey: 'nav.staff', needs: 'officer.read' },
];

/** PURE. The items this officer sees, in menu order. */
export function navItemsFor(permissions: readonly string[]): readonly NavItem[] {
  return ITEMS.filter((i) => i.needs === null || permissions.includes(i.needs)).map(({ id, href, labelKey }) => ({ id, href, labelKey }));
}
