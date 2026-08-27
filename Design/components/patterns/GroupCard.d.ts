import * as React from 'react';

/**
 * One ride group: direction, departure, who has answered, what to do next.
 */
export interface GroupCardProps {
  origin: string;
  destination: string;
  /** Already formatted — "Fri 14 Mar, 6:30 PM". */
  departure?: string;
  status?: 'forming' | 'matched' | 'active' | 'completed' | 'cancelled';
  members?: { name: string; avatarUrl?: string; status?: 'accepted' | 'pending' | 'declined'; organiser?: boolean }[];
  pendingCount?: number;
  highlighted?: boolean;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function GroupCard(props: GroupCardProps): React.ReactElement;
