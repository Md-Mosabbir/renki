import * as React from 'react';

/**
 * A person, as initials or a photo. Square in lists, round on cards.
 */
export interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  /** Square in lists, round on cards. */
  shape?: 'square' | 'round';
  /** 40% opacity — a member who has not replied yet. */
  dim?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Avatar(props: AvatarProps): React.ReactElement;
