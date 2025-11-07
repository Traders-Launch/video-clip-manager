'use client';

import { useState, useEffect, RefObject } from 'react';
import { Clip, ViewMode } from '@/types';
import { formatTime } from '@/lib/utils';

interface ControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  trimStart: number;
  trimEnd: number;
  viewMode: ViewMode;
  currentPreviewClip: Clip | null;
  currentSegmentIndex: number;
  videoDuration: number;
  onSetTrimStart: () => void;
  onSetTrimEnd: () => void;
  onCreateClip: () => void;
  onExitPreview: () => void;
}

export default function Controls({
  videoRef,
  trimStart,
  trimEnd,
  viewMode,
  currentPreviewClip,
  currentSegmentIndex,
  videoDuration,
  onSetTrimStart,
  onSetTrimEnd,
  onCreateClip,
  onExitPreview,
}: ControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const getPreviewElapsedTime = (
    clip: Clip,
    segmentIndex: number,
    videoCurrentTime: number
  ) => {
    if (!clip.segments.length) return 0;

    const safeIndex = Math.min(Math.max(segmentIndex, 0), clip.segments.length - 1);
    const elapsedBefore = clip.segments
      .slice(0, safeIndex)
      .reduce((sum, segment) => sum + (segment.end - segment.start), 0);

    const activeSegment = clip.segments[safeIndex];
    const segmentDuration = Math.max(activeSegment.end - activeSegment.start, 0);
    const withinSegment = Math.min(
      Math.max(videoCurrentTime - activeSegment.start, 0),
      segmentDuration
    );

    return elapsedBefore + withinSegment;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleTimeUpdate = () => {
      if (viewMode === 'preview' && currentPreviewClip) {
        const previewElapsed = getPreviewElapsedTime(
          currentPreviewClip,
          currentSegmentIndex,
          video.currentTime
        );
        setCurrentTime(previewElapsed);
      } else {
        const safeCurrentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        setCurrentTime(Math.max(0, safeCurrentTime));
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, viewMode, currentPreviewClip, currentSegmentIndex]);

  const durationValue =
    viewMode === 'preview' && currentPreviewClip ? currentPreviewClip.duration : videoDuration;

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  return (
    <div className="flex gap-2.5 items-center flex-wrap mt-4">
      {viewMode === 'preview' && (
        <button
          onClick={onExitPreview}
          className="bg-[#444] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
        >
          ← Back to Edit Mode
        </button>
      )}

      <button
        onClick={togglePlayPause}
        className="bg-[#0a84ff] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#0066cc] transition-all"
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      {viewMode === 'edit' && (
        <>
          <button
            onClick={onSetTrimStart}
            className="bg-[#444] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
          >
            Set In Point
          </button>

          <button
            onClick={onSetTrimEnd}
            className="bg-[#444] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
          >
            Set Out Point
          </button>

          <button
            onClick={onCreateClip}
            className="bg-[#30d158] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#28a745] transition-all"
          >
            Create Clip
          </button>
        </>
      )}

      <div className="bg-[#333] px-4 py-2 rounded-md text-[13px] font-mono">
        <span>{formatTime(currentTime)}</span> / <span>{formatTime(durationValue)}</span>
      </div>

      {viewMode === 'edit' && (
        <div className="bg-[#333] px-4 py-2 rounded-md text-[13px] font-mono">
          Trim: <span>{formatTime(trimStart)} - {formatTime(trimEnd)}</span>
        </div>
      )}

      {viewMode === 'preview' && currentPreviewClip && (
        <div className="bg-[#333] px-4 py-2 rounded-md text-[13px] font-mono">
          {currentPreviewClip.name}
        </div>
      )}
    </div>
  );
}
