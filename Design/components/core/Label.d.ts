import * as React from 'react';

/**
 * Field label, or the uppercase eyebrow used for section headings.
 */
export interface LabelProps {
  htmlFor?: string;
  /** Uppercase, wide-tracked, muted — Renki's section heading style. */
  eyebrow?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Label(props: LabelProps): React.ReactElement;
