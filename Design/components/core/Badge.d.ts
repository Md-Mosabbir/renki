import * as React from 'react';

/**
 * A status stamp: square shoulders, leading rule, wide-tracked mono label.
 */
export interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'brand';
  /** Adds the hopping amber square — the state is happening right now. */
  live?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Badge(props: BadgeProps): React.ReactElement;
