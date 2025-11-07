'use client';

type BadgeStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'draft'
  | 'rendering'
  | 'ready';

interface JobBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<
  BadgeStatus,
  { label: string; color: string }
> = {
  queued: { label: 'Queued', color: 'bg-[#444] text-[#ddd]' },
  processing: { label: 'Processing', color: 'bg-[#0a84ff]/20 text-[#0a84ff]' },
  completed: { label: 'Ready', color: 'bg-[#30d158]/20 text-[#30d158]' },
  failed: { label: 'Failed', color: 'bg-[#ff453a]/20 text-[#ff453a]' },
  draft: { label: 'Draft', color: 'bg-[#444] text-[#ddd]' },
  rendering: { label: 'Rendering', color: 'bg-[#0a84ff]/20 text-[#0a84ff]' },
  ready: { label: 'Ready', color: 'bg-[#30d158]/20 text-[#30d158]' },
};

export default function JobBadge({ status, size = 'sm' }: JobBadgeProps) {
  const style = STATUS_STYLES[status];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
  return (
    <span
      className={`uppercase tracking-wide rounded-full font-semibold ${style.color} ${padding}`}
    >
      {style.label}
    </span>
  );
}
