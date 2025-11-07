'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IngestJob, IngestSourceDraft } from '@/types';
import {
  createIngestJob,
  getIngestJob,
  listMockConnectorAssets,
} from '@/lib/client/api';
import JobBadge from './JobBadge';

interface IngestConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestCompleted: (drafts: IngestSourceDraft[], job: IngestJob) => void;
}

interface ConnectorAsset {
  externalId: string;
  name: string;
  checksum: string;
  durationSec: number;
}

export default function IngestConnectModal({
  isOpen,
  onClose,
  onIngestCompleted,
}: IngestConnectModalProps) {
  const [assets, setAssets] = useState<ConnectorAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<IngestJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }

    let isMounted = true;
    listMockConnectorAssets()
      .then(({ assets }) => {
        if (isMounted) {
          setAssets(assets);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Failed to load connector assets');
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const toggleSelection = (assetId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.has(asset.externalId)),
    [assets, selected]
  );

  const handleSubmit = async () => {
    if (!selectedAssets.length) {
      setError('Select at least one asset to ingest.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { job } = await createIngestJob({
        connector: 'mock',
        assets: selectedAssets,
      });
      setJob(job);
      notifiedRef.current = false;
      startPolling(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ingest job');
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const response = await getIngestJob(jobId);
        setJob(response.job);
        if (
          response.job.status === 'completed' &&
          response.sourceDrafts &&
          !notifiedRef.current
        ) {
          notifiedRef.current = true;
          onIngestCompleted(response.sourceDrafts, response.job);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job status');
        stopPolling();
      }
    }, 1200);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const reset = () => {
    stopPolling();
    setAssets([]);
    setSelected(new Set());
    setJob(null);
    setError(null);
    notifiedRef.current = false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#1f1f1f] rounded-xl w-full max-w-3xl border border-[#333] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <div>
            <h2 className="text-xl font-semibold m-0">Connect &amp; Ingest</h2>
            <p className="text-sm text-[#999] m-0">
              Choose assets from the mock connector to bring them into your library.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#bbb] hover:text-white text-2xl leading-none bg-transparent border-none cursor-pointer"
            aria-label="Close ingest modal"
          >
            ×
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-auto">
          {error && (
            <div className="bg-[#4a1f1f] border border-[#ff453a] text-[#ffb3ac] px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.map((asset) => (
              <label
                key={asset.externalId}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selected.has(asset.externalId)
                    ? 'border-[#0a84ff] bg-[#0a84ff]/10'
                    : 'border-[#333] hover:border-[#444]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold mb-1 text-sm">{asset.name}</p>
                    <p className="text-xs text-[#888] m-0">
                      Duration: {Math.round(asset.durationSec)}s
                    </p>
                    <p className="text-[11px] text-[#666] mt-1 break-all">
                      checksum: {asset.checksum}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selected.has(asset.externalId)}
                    onChange={() => toggleSelection(asset.externalId)}
                    className="w-5 h-5 accent-[#0a84ff]"
                  />
                </div>
              </label>
            ))}
            {!assets.length && (
              <div className="col-span-full text-center text-[#777] py-10">
                Loading connector assets…
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#333] pt-4">
            <div className="flex items-center gap-3 text-sm text-[#bbb]">
              <span>{selectedAssets.length} selected</span>
              {job && <JobBadge status={job.status} />}
              {job && (
                <span className="text-xs text-[#888]">
                  Progress: {job.progress.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-[#0a84ff] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0066cc] disabled:opacity-60"
              >
                {job ? 'Re-run Ingest' : 'Ingest Selected'}
              </button>
              <button
                onClick={onClose}
                className="bg-transparent border border-[#444] text-white px-4 py-2 rounded-lg text-sm font-medium hover:border-[#666]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
