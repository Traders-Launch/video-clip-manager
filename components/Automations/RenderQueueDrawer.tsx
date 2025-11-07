'use client';

import { RenderJob } from '@/types';
import JobBadge from './JobBadge';

interface RenderQueueDrawerProps {
  isOpen: boolean;
  jobs: RenderJob[];
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
}

export default function RenderQueueDrawer({
  isOpen,
  jobs,
  onClose,
  onRefresh,
}: RenderQueueDrawerProps) {
  if (!isOpen) return null;

  const sortedJobs = [...jobs].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70">
      <div className="w-full max-w-lg bg-[#181818] h-full p-6 overflow-y-auto shadow-2xl border-l border-[#333]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#888] m-0">
              Render Queue
            </p>
            <h2 className="text-2xl font-semibold m-0">Batch Renders</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="text-xs bg-transparent border border-[#444] text-white px-3 py-1.5 rounded-lg hover:border-[#666]"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-[#bbb] hover:text-white text-2xl leading-none bg-transparent border-none cursor-pointer"
              aria-label="Close render drawer"
            >
              ×
            </button>
          </div>
        </div>

        {sortedJobs.length === 0 ? (
          <div className="text-center text-[#666] py-10 text-sm">
            Queue render jobs from the Variations panel to see them here.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sortedJobs.map((job) => (
              <div
                key={job.id}
                className="border border-[#333] rounded-lg p-4 bg-[#1f1f1f]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold m-0">
                      Job {job.id.slice(0, 6).toUpperCase()}
                    </p>
                    <p className="text-xs text-[#888] m-0">
                      {job.variationIds.length} variation(s)
                    </p>
                  </div>
                  <JobBadge status={job.status === 'completed' ? 'ready' : job.status} />
                </div>
                <div className="text-xs text-[#777] mt-2">
                  Progress {job.progress}% · Updated{' '}
                  {new Date(job.updatedAt).toLocaleTimeString()}
                </div>
                {job.outputUrls && job.outputUrls.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-[#666] m-0">
                      Outputs
                    </p>
                    {job.outputUrls.map((url, index) => (
                      <a
                        key={`${url}-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[#0a84ff] text-sm underline truncate"
                      >
                        Download #{index + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

