import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CircleDashed,
  PauseCircle,
  Send,
  FileEdit,
  XCircle,
} from 'lucide-react';

type BadgeTone = 'purple' | 'teal' | 'blue' | 'amber' | 'green' | 'crimson' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  purple: 'bg-[#7853E8]/10 text-[#5B36CC] border-[#7853E8]/20',
  teal: 'bg-[#39B5B6]/10 text-[#1E8283] border-[#39B5B6]/25',
  blue: 'bg-[#78A7E8]/15 text-[#2E5FA3] border-[#78A7E8]/30',
  amber: 'bg-[#E9AD58]/15 text-[#9A6312] border-[#E9AD58]/30',
  green: 'bg-[#2DAA82]/12 text-[#1A7A5B] border-[#2DAA82]/25',
  crimson: 'bg-[#DC2626]/10 text-[#B91C1C] border-[#DC2626]/20',
  neutral: 'bg-[#F4F5FC] text-[#4E596F] border-[#E7E9F1]',
};

const STATUS_MAP: Record<string, { tone: BadgeTone; Icon: React.ComponentType<{ className?: string }> }> = {
  // Tasks & Projects
  'Completed': { tone: 'green', Icon: CheckCircle2 },
  'In Progress': { tone: 'purple', Icon: Clock },
  'Not Started': { tone: 'neutral', Icon: CircleDashed },
  'Waiting': { tone: 'amber', Icon: PauseCircle },
  'On Hold': { tone: 'amber', Icon: PauseCircle },
  // Priorities
  'Urgent': { tone: 'crimson', Icon: AlertCircle },
  'High': { tone: 'amber', Icon: AlertCircle },
  'Medium': { tone: 'blue', Icon: Clock },
  'Low': { tone: 'neutral', Icon: CircleDashed },
  // Clients
  'Retainer': { tone: 'purple', Icon: CheckCircle2 },
  'Active': { tone: 'green', Icon: CheckCircle2 },
  'Lead': { tone: 'blue', Icon: Clock },
  'Inactive': { tone: 'neutral', Icon: PauseCircle },
  // Invoices
  'Paid': { tone: 'green', Icon: CheckCircle2 },
  'Partially Paid': { tone: 'teal', Icon: Clock },
  'Sent': { tone: 'blue', Icon: Send },
  'Draft': { tone: 'neutral', Icon: FileEdit },
  'Overdue': { tone: 'crimson', Icon: AlertCircle },
  // Proposals
  'Accepted': { tone: 'green', Icon: CheckCircle2 },
  'Under Review': { tone: 'purple', Icon: Clock },
  'Follow-up Due': { tone: 'amber', Icon: AlertCircle },
  'Declined': { tone: 'crimson', Icon: XCircle },
  // Billable / Verified
  'Billable': { tone: 'teal', Icon: CheckCircle2 },
  'Non-Billable': { tone: 'neutral', Icon: CircleDashed },
  'Verified': { tone: 'green', Icon: CheckCircle2 },
  'Pending Verification': { tone: 'amber', Icon: AlertCircle },
};

export function StatusBadge({ label, tone }: { label: string; tone?: BadgeTone }) {
  const mapped = STATUS_MAP[label];
  const resolvedTone = tone ?? mapped?.tone ?? 'neutral';
  const Icon = mapped?.Icon ?? CircleDashed;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${TONE_CLASSES[resolvedTone]}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
