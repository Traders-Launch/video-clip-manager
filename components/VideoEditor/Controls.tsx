'use client';

import { useState, useEffect, RefObject } from 'react';
import { Clip, ViewMode } from '@/types';
import { formatTime } from '@/lib/utils';

interface ControlsProps {
  videoRef: RefObject<HTMLVideoElement>;
  trimStart: number;
  trimEnd: number;
  viewMode: ViewMode;
  currentPreviewClip: Clip | null;
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
  onSetTrimStart,
  onSetTrimEnd,
  onCreateClip,
  onExitPreview,
}: ControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleTimeUpdate = () => {
      if (viewMode === 'preview' && currentPreviewClip) {
        const segment = currentPreviewClip.segments[0]; // Using first segment for relative time
        setCurrentTime(Math.max(0, video.currentTime - segment.start));
      } else {
        setCurrentTime(video.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (viewMode === 'preview' && currentPreviewClip) {
        setDuration(currentPreviewClip.duration);
      } else {
        setDuration(video.duration);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef, viewMode, currentPreviewClip]);

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
        <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
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
