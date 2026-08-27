import * as React from 'react';

/**
 * A slow sheen standing in for content whose shape is known.
 */
export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Skeleton(props: SkeletonProps): React.ReactElement;
