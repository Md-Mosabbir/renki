import * as React from 'react';

/**
 * A bordered row offering one of the ways to find a ride.
 */
export interface RideOptionProps {
  icon?: React.ReactNode;
  title: string;
  body: string;
  /** Disabled rather than hidden when the account cannot ride. */
  enabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export declare function RideOption(props: RideOptionProps): React.ReactElement;
