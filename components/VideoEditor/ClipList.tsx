'use client';

import { Clip } from '@/types';
import { formatTime } from '@/lib/utils';

interface ClipListProps {
  clips: Clip[];
  selectedClips: Set<number>;
  onToggleSelection: (clipId: number) => void;
  onPreview: (clipId: number) => void;
  onDuplicate: (clipId: number) => void;
  onDelete: (clipId: number) => void;
  onEditText: (clipId: number) => void;
  onCombineSelected: () => void;
  onClearAll: () => void;
}

export default function ClipList({
  clips,
  selectedClips,
  onToggleSelection,
  onPreview,
  onDuplicate,
  onDelete,
  onEditText,
  onCombineSelected,
  onClearAll,
}: ClipListProps) {
  return (
    <div className="bg-[#2a2a2a] rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold m-0">
          Clip Variations ({clips.length})
        </h2>

        <div className="flex gap-2">
          {selectedClips.size >= 2 && (
            <button
              onClick={onCombineSelected}
              className="bg-[#30d158] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#28a745] transition-all"
            >
              Combine Selected ({selectedClips.size})
            </button>
          )}

          {clips.length > 0 && (
            <button
              onClick={onClearAll}
              className="bg-[#ff453a] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#cc362e] transition-all"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="text-center py-10 text-[#666]">
          No clips yet. Set in/out points and create your first clip!
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isSelected={selectedClips.has(clip.id)}
              onToggleSelection={() => onToggleSelection(clip.id)}
              onPreview={() => onPreview(clip.id)}
              onDuplicate={() => onDuplicate(clip.id)}
              onDelete={() => onDelete(clip.id)}
              onEditText={() => onEditText(clip.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ClipCardProps {
  clip: Clip;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditText: () => void;
}

function ClipCard({
  clip,
  isSelected,
  onToggleSelection,
  onPreview,
  onDuplicate,
  onDelete,
  onEditText,
}: ClipCardProps) {
  const segmentInfo = clip.isCombined
    ? `${clip.segments.length} segments combined`
    : `${formatTime(clip.segments[0].start)} - ${formatTime(clip.segments[0].end)}`;

  return (
    <div
      className={`
        bg-[#333] p-4 rounded-lg border-2 transition-all
        ${isSelected ? 'border-[#30d158] bg-[#3a3f3a]' : 'border-transparent hover:border-[#0a84ff]'}
        ${clip.isCombined ? 'border-[#bf5af2]' : ''}
      `}
    >
      <div className="flex justify-between items-center mb-2.5">
        <div className="font-semibold text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="w-[18px] h-[18px] cursor-pointer"
          />
          {clip.name}
          {clip.isCombined && (
            <span className="bg-[#bf5af2] text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
              COMBINED
            </span>
          )}
          {clip.textOverlay && (
            <span className="bg-[#ff9f0a] text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
              TEXT
            </span>
          )}
        </div>
      </div>

      <div className="text-[13px] text-[#999] mb-2.5">
        {segmentInfo}
        <br />
        Total Duration: {formatTime(clip.duration)}
        {clip.textOverlay && (
          <>
            <br />
            Text: &quot;{clip.textOverlay.content}&quot;
          </>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onEditText}
          className="bg-[#ff9f0a] text-white border-none px-3 py-1.5 rounded-lg cursor-pointer text-xs hover:bg-[#e68a00] transition-all"
        >
          Edit Text
        </button>

        <button
          onClick={onPreview}
          className="bg-[#444] text-white border-none px-3 py-1.5 rounded-lg cursor-pointer text-xs hover:bg-[#555] transition-all"
        >
          Preview
        </button>

        <button
          onClick={onDuplicate}
          className="bg-[#444] text-white border-none px-3 py-1.5 rounded-lg cursor-pointer text-xs hover:bg-[#555] transition-all"
        >
          Duplicate
        </button>

        <button
          onClick={onDelete}
          className="bg-[#ff453a] text-white border-none px-3 py-1.5 rounded-lg cursor-pointer text-xs hover:bg-[#cc362e] transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
