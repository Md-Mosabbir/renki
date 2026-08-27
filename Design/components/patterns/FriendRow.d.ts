import * as React from 'react';

/**
 * One person in a list; only the right-hand side changes.
 */
export interface FriendRowProps {
  name: string;
  /** University, or why this row is here ("Met 3 Mar"). */
  note?: string;
  avatarUrl?: string;
  /** Right-hand actions. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function FriendRow(props: FriendRowProps): React.ReactElement;
