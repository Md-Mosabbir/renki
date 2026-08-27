import * as React from 'react';

/**
 * The signed-in frame: a bottom bar on phones, a rail from md up.
 */
export interface NavShellProps {
  items: { href: string; label: string; icon?: React.ReactNode }[];
  active?: string;
  onNavigate?: (href: string) => void;
  /** 'mobile' renders the bottom bar; 'sidebar' the desktop rail. */
  variant?: 'mobile' | 'sidebar';
  /** Slot beside the wordmark in the sidebar — the notification bell. */
  header?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function NavShell(props: NavShellProps): React.ReactElement;
