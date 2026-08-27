import * as React from 'react';

/**
 * The Renki wordmark: the amber square plus RENKI in wide-tracked uppercase.
 */
export interface WordmarkProps {
  /** 'inverse' on dark grounds — the square stays amber either way. */
  tone?: 'default' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export declare function Wordmark(props: WordmarkProps): React.ReactElement;
