import * as React from 'react';

/**
 * The "here is where you stand" banner: 2px left rule, tinted ground.
 */
export interface StatusBannerProps {
  tone?: 'neutral' | 'brand' | 'danger';
  icon?: React.ReactNode;
  title?: string;
  body?: string;
  /** A link or button — a banner that states a setting must lead to it. */
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function StatusBanner(props: StatusBannerProps): React.ReactElement;
