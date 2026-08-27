import * as React from 'react';

/**
 * Cold-start loader: the mark hops and returns to where it started.
 */
export interface AppLoaderProps {
  /** Announced to screen readers and shown under the mark. */
  label?: string;
  className?: string;
}

export declare function AppLoader(props: AppLoaderProps): React.ReactElement;
