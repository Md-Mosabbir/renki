import * as React from 'react';

/**
 * A surface with a hairline ring and no shadow.
 */
export interface CardProps {
  size?: 'default' | 'sm';
  /** Replace the ring with the amber left rule — for live state. */
  accent?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): React.ReactElement;
