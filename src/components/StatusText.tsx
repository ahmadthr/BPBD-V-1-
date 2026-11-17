import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { ConditionStatus } from '../types/simas';
import { CONDITION_META } from '../utils/formatters';

interface ConditionIndicatorProps {
  condition: ConditionStatus;
  compact?: boolean;
}

export const ConditionIndicator: React.FC<ConditionIndicatorProps> = ({
  condition,
  compact = false,
}) => {
  const meta = CONDITION_META[condition];

  const Icon =
    condition === 'BAIK'
      ? CheckCircle2
      : condition === 'RUSAK_RINGAN'
        ? AlertTriangle
        : XCircle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${meta.textClass} ${
        compact ? 'text-xs' : 'text-xs'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
};
