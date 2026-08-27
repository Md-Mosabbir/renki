import * as React from 'react';

/**
 * A 2px hairline progress rule with square ends.
 */
export interface ProgressProps {
  /** 0-100. */
  value?: number;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Progress(props: ProgressProps): React.ReactElement;
