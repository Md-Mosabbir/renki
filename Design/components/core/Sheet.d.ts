import * as React from 'react';

/**
 * A bottom sheet — the one surface allowed a shadow.
 */
export interface SheetProps {
  open?: boolean;
  title?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Sheet(props: SheetProps): React.ReactElement;
