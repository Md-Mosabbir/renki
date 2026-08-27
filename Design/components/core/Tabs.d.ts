import * as React from 'react';

/**
 * Tabs over one fetch; the active tab carries the amber underline.
 */
export interface TabsProps {
  tabs: { value: string; label: string; count?: number | string }[];
  value?: string;
  onChange?: (value: string) => void;
  children?: React.ReactNode | ((active: string) => React.ReactNode);
  className?: string;
  style?: React.CSSProperties;
}

export declare function Tabs(props: TabsProps): React.ReactElement;
