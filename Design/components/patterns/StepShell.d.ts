import * as React from 'react';

/**
 * The onboarding step frame: mono counter, hairline rule, serif question.
 */
export interface StepShellProps {
  step?: number;
  total?: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export declare function StepShell(props: StepShellProps): React.ReactElement;
