'use client';

import { useMemo, useRef } from 'react';
import { formatTime } from '@/lib/utils';
import { SourceId, VideoSource } from '@/types';

interface VideoLibraryProps {
  sources: Record<SourceId, VideoSource>;
  activeSourceId: SourceId | null;
  clipCountBySource: Record<SourceId, number>;
  onAddVideos: (files: File[]) => void;
  onSelectSource: (sourceId: SourceId) => void;
  onRemoveSource: (sourceId: SourceId) => void;
  isRestoring?: boolean;
}

export default function VideoLibrary({
  sources,
  activeSourceId,
  clipCountBySource,
  onAddVideos,
  onSelectSource,
  onRemoveSource,
  isRestoring = false,
}: VideoLibraryProps) {
  const sourceList = useMemo(
    () => Object.values(sources).sort((a, b) => a.createdAt - b.createdAt),
    [sources]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) {
      onAddVideos(files);
    }
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []).filter(file =>
      file.type.startsWith('video/')
    );
    if (files.length) {
      onAddVideos(files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <aside
      className="bg-[#2a2a2a] rounded-xl p-4 flex flex-col gap-4 max-w-[320px] w-full border border-[#333]"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-tour-id="library"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">Video Library</h2>
          <p className="text-xs text-[#999] m-0">
            Manage sources &amp; clip counts
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-[#0a84ff] text-white border-none px-3 py-1.5 rounded-md cursor-pointer text-xs font-medium hover:bg-[#0066cc] transition-all"
        >
          Add
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {sourceList.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[#aaa] border border-dashed border-[#444] rounded-lg p-6">
          <p className="text-sm text-[#ccc] mb-2">No videos yet</p>
          <p className="text-xs text-[#888]">
            Click &ldquo;Add&rdquo; or drag files here to start
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-auto pr-1">
          {sourceList.map((source) => (
            <div
              key={source.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectSource(source.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectSource(source.id);
                }
              }}
              className={`
                text-left bg-[#333] rounded-lg p-3 border transition-all relative cursor-pointer
                ${activeSourceId === source.id ? 'border-[#0a84ff] shadow-[0_0_0_1px_rgba(10,132,255,0.6)]' : 'border-transparent hover:border-[#0a84ff]/40'}
                ${!source.url ? 'opacity-80' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm truncate">{source.name}</div>
                <span className="text-[11px] bg-[#444] px-2 py-0.5 rounded-full text-[#ddd]">
                  {clipCountBySource[source.id] ?? 0} clips
                </span>
              </div>
              <div className="mt-2 text-xs text-[#aaa] space-y-1">
                <p className="m-0">
                  Duration:{' '}
                  {source.duration > 0 ? formatTime(source.duration) : '–:–'}
                </p>
                <p className="m-0 truncate text-[#888]">{source.fileName}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {source.origin === 'connector' && source.connector && (
                    <span className="text-[10px] uppercase tracking-wide bg-[#3a3a3a] px-2 py-0.5 rounded-full text-[#ddd] border border-[#4a4a4a]">
                      {source.connector.toUpperCase()}
                    </span>
                  )}
                  {source.proxyReady === false && (
                    <span className="text-[10px] text-[#ff9f0a] uppercase tracking-wide">
                      Proxy Pending
                    </span>
                  )}
                </div>
                {!source.url && (
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      source.hasPersistentFile ? 'text-[#0a84ff]' : 'text-[#ff9f0a]'
                    }`}
                  >
                    {source.hasPersistentFile
                      ? isRestoring
                        ? 'Restoring local copy...'
                        : 'Local copy missing — re-import'
                      : 'Re-import to preview'}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveSource(source.id);
                }}
                className="absolute top-2 right-2 text-[#999] hover:text-white/90 text-base leading-none bg-transparent border-none cursor-pointer p-1 rounded"
                aria-label={`Remove ${source.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
