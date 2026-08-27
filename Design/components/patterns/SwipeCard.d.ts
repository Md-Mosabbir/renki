import * as React from 'react';

/**
 * One rider in the deck, with the facts a person needs before saying yes.
 */
export interface SwipeCardProps {
  name: string;
  avatarUrl?: string;
  badge?: { label: string; accepted?: boolean };
  facts?: { icon?: React.ReactNode; label: string; value: string }[];
  /** Drag intent stamp: 'yes' | 'no'. */
  intent?: 'yes' | 'no' | null;
  note?: string;
  /** Horizontal drag offset in px; also drives the tilt. */
  offset?: number;
  className?: string;
  style?: React.CSSProperties;
}

export declare function SwipeCard(props: SwipeCardProps): React.ReactElement;
