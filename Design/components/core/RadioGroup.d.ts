import * as React from 'react';

/**
 * Full-width option rows, one per line, each with room for a sentence.
 */
export interface RadioGroupProps {
  options: { value: string; label: string; description?: string }[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export declare function RadioGroup(props: RadioGroupProps): React.ReactElement;
