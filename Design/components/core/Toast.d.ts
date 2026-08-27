import * as React from 'react';

/**
 * A top-centre toast: a left rule, a shadow, and a full sentence.
 */
export interface ToastProps {
  tone?: 'default' | 'success' | 'error';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Toast(props: ToastProps): React.ReactElement;
