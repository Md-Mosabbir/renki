'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, History, Users, UsersRound, User as UserIcon } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { NotificationBell } from '@/components/notifications/notification-bell';

/**
 * The signed-in frame.
 *
 * Two different navigations, not one stretched to fit: a bottom bar under
 * `md`, a fixed sidebar at `md` and above. A bottom bar on a 1440px monitor
 * puts the primary controls as far from the cursor as the screen allows, and a
 * sidebar on a phone eats a third of the width — so each breakpoint gets the
 * pattern that belongs to it and the other is removed from the tree.
 *
 * Both render the same list from one source, so a destination cannot appear in
 * one and be forgotten in the other.
 */
const NAV = [
  { href: '/rides', label: 'Rides', icon: Car },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/history', label: 'History', icon: History },
  { href: '/profile', label: 'Profile', icon: UserIcon },
] as const;

function useIsActive(pathname: string) {
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = useIsActive(pathname);

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* ---- Desktop: fixed sidebar ---- */}
      <aside className="border-border hidden shrink-0 border-r md:flex md:w-56 md:flex-col lg:w-64">
        <div className="sticky top-0 flex h-screen flex-col p-6">
          <div className="mb-10 flex items-center justify-between">
            <Wordmark />
            <NotificationBell />
          </div>

          <nav aria-label="Primary">
            <ul className="space-y-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex cursor-pointer items-center gap-3 border-l-2 py-2.5 pl-4 text-sm font-medium transition-colors duration-200 ${
                        active
                          ? 'border-brand text-foreground'
                          : 'text-muted-foreground hover:text-foreground border-transparent'
                      }`}
                    >
                      <Icon className="size-4" strokeWidth={active ? 2.25 : 1.75} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* ---- Content ---- */}
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        {/*
          The bell is a top bar on mobile rather than a sixth item in the
          bottom nav. Five slots already divide a 375px screen into 75px
          columns; a sixth drops each below the 44px tap-target floor the rest
          of this file is careful about.

          The wordmark lives here and NOWHERE else under `md`. Five pages used
          to carry their own `md:hidden` header for it, which meant adding this
          bar put two Renki wordmarks on top of each other — and meant Friends
          and Groups, which never had one, showed no branding at all. One
          source, same argument as NAV above.
        */}
        <div className="border-border flex items-center justify-between border-b px-4 py-2 md:hidden">
          <Wordmark />
          <NotificationBell />
        </div>
        {children}
      </div>

      {/* ---- Mobile: bottom bar ---- */}
      <nav
        aria-label="Primary"
        className="border-border bg-background/95 fixed inset-x-0 bottom-0 border-t backdrop-blur-sm md:hidden"
        // Keeps the bar above the home indicator on phones that have one.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-md">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  // min-h-14 keeps the tap target above the 44px floor.
                  className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 transition-colors duration-200 ${
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-[11px] font-medium tracking-wide">{label}</span>
                  <span
                    className={`h-0.5 w-6 transition-colors duration-200 ${
                      active ? 'bg-brand' : 'bg-transparent'
                    }`}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/**
 * Page-level width container.
 *
 * Reading measure is capped so long text does not run to 1440px, but the cap is
 * generous enough that a wide screen still shows a page rather than a phone
 * floating in whitespace.
 */
export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-md px-6 py-8 md:max-w-3xl md:px-10 md:py-12 lg:max-w-5xl ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
