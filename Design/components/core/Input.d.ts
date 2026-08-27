import * as React from 'react';

/**
 * Single-line text field: 32px, 4px radius, hairline border, no fill.
 */
export interface InputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  size?: 'default' | 'lg';
  disabled?: boolean;
  invalid?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Input(props: InputProps): React.ReactElement;
