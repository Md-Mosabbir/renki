import * as React from 'react';

/**
 * The button: ink-filled, square-shouldered, signed with the amber mark.
 */
export interface ButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg';
  /** Square corners — primary calls to action on full-bleed screens. */
  square?: boolean;
  /** The leading amber square. Defaults on for filled variants, off for icon-only. */
  mark?: boolean;
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): React.ReactElement;
