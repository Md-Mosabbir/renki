import * as React from 'react';

/**
 * The scannable meetup plate: flat, static, maximum contrast, hard edges.
 */
export interface CodePlateProps {
  /** The meetup code the symbol stands for. */
  code?: string;
  size?: number;
  /** Small mono caption under the plate. */
  caption?: string;
  className?: string;
}

export declare function CodePlate(props: CodePlateProps): React.ReactElement;
