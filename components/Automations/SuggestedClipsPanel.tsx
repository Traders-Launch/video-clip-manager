'use client';

import { AISuggestedClip, SourceId } from '@/types';
import { formatTime } from '@/lib/utils';

interface SuggestedClipsPanelProps {
  sourceId: SourceId;
  suggestions: AISuggestedClip[];
  onAccept: (suggestionId: string) => void;
  onDiscard: (suggestionId: string) => void;
}

export default function SuggestedClipsPanel({
  sourceId,
  suggestions,
  onAccept,
  onDiscard,
}: SuggestedClipsPanelProps) {
  if (!suggestions.length) return null;

  return (
    <div className="bg-[#1f1f1f] border border-[#333] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-[#888] uppercase tracking-wide m-0">
            Suggestions for {sourceId}
          </p>
          <h3 className="text-lg font-semibold m-0">
            AI Shot Miner ({suggestions.length})
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="bg-[#282828] border border-[#3a3a3a] rounded-lg p-3 flex flex-col gap-2"
          >
            <div className="flex justify-between items-center gap-2">
              <div>
                <p className="text-sm font-semibold m-0">
                  {suggestion.label ?? 'Suggested Clip'}
                </p>
                <p className="text-xs text-[#999] m-0">
                  Confidence {Math.round(suggestion.confidence * 100)}%
                </p>
              </div>
              <div className="text-[11px] uppercase tracking-wide text-[#aaa] bg-[#3a3a3a] px-2 py-0.5 rounded-full">
                {suggestion.tags?.[0] ?? 'highlight'}
              </div>
            </div>

            {suggestion.summary && (
              <p className="text-xs text-[#bbb] m-0">{suggestion.summary}</p>
            )}

            <div className="text-xs text-[#888]">
              {suggestion.segments.map((segment, index) => (
                <div key={`${segment.start}-${segment.end}-${index}`}>
                  Segment {index + 1}: {formatTime(segment.start)} -{' '}
                  {formatTime(segment.end)}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onAccept(suggestion.id)}
                className="flex-1 bg-[#30d158] text-white text-xs font-semibold rounded-lg py-1.5 hover:bg-[#28a745] transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onDiscard(suggestion.id)}
                className="flex-1 bg-transparent border border-[#444] text-[#bbb] text-xs font-semibold rounded-lg py-1.5 hover:border-[#666]"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

