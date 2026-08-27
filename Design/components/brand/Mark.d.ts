import * as React from 'react';

/**
 * The bare square: a bullet, a stop on a route, a list marker.
 */
export interface MarkProps {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'ink' | 'muted';
  className?: string;
  style?: React.CSSProperties;
}

export declare function Mark(props: MarkProps): React.ReactElement;
