'use client';

import { useEffect, useState, useRef, RefObject } from 'react';
import { Clip, ViewMode } from '@/types';

interface TimelineProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  trimStart: number;
  trimEnd: number;
  viewMode: ViewMode;
  currentPreviewClip: Clip | null;
  currentSegmentIndex: number;
  onTrimStartChange: (value: number) => void;
  onTrimEndChange: (value: number) => void;
}

export default function Timeline({
  videoRef,
  trimStart,
  trimEnd,
  viewMode,
  currentPreviewClip,
  currentSegmentIndex,
  onTrimStartChange,
  onTrimEndChange,
}: TimelineProps) {
  const [progress, setProgress] = useState(0);
  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (viewMode === 'preview' && currentPreviewClip) {
        const segment = currentPreviewClip.segments[currentSegmentIndex];
        const relativeTime = video.currentTime - segment.start;
        const segmentDuration = segment.end - segment.start;
        const clipProgress = (relativeTime / segmentDuration) * 100;
        setProgress(Math.max(0, Math.min(100, clipProgress)));
      } else {
        const percent = (video.currentTime / video.duration) * 100;
        setProgress(percent);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoRef, viewMode, currentPreviewClip, currentSegmentIndex]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !videoRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;

    if (viewMode === 'preview' && currentPreviewClip) {
      const segment = currentPreviewClip.segments[currentSegmentIndex];
      const segmentDuration = segment.end - segment.start;
      videoRef.current.currentTime = segment.start + (percent * segmentDuration);
    } else {
      videoRef.current.currentTime = percent * videoRef.current.duration;
    }
  };

  const handleMarkerMouseDown = (marker: 'start' | 'end') => (e: React.MouseEvent) => {
    if (viewMode === 'preview') return;
    e.stopPropagation();
    setDraggingMarker(marker);
  };

  useEffect(() => {
    if (!draggingMarker) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current || !videoRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      let percent = (e.clientX - rect.left) / rect.width;
      percent = Math.max(0, Math.min(1, percent));

      const time = percent * videoRef.current.duration;

      if (draggingMarker === 'start') {
        onTrimStartChange(Math.min(time, trimEnd));
      } else {
        onTrimEndChange(Math.max(time, trimStart));
      }
    };

    const handleMouseUp = () => {
      setDraggingMarker(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMarker, videoRef, trimStart, trimEnd, onTrimStartChange, onTrimEndChange]);

  const startPercent = videoRef.current ? (trimStart / videoRef.current.duration) * 100 : 0;
  const endPercent = videoRef.current ? (trimEnd / videoRef.current.duration) * 100 : 100;

  return (
    <div className="my-5 relative">
      <div
        ref={trackRef}
        className="w-full h-2 bg-[#444] rounded cursor-pointer relative"
        onClick={handleTrackClick}
      >
        <div
          className="h-full bg-[#0a84ff] rounded relative"
          style={{ width: `${progress}%` }}
        />

        {viewMode === 'edit' && (
          <div className="absolute -top-2.5 left-0 right-0 h-7 pointer-events-none">
            <div
              className="absolute w-[3px] h-7 bg-[#ffd60a] cursor-ew-resize pointer-events-auto"
              style={{ left: `${startPercent}%` }}
              onMouseDown={handleMarkerMouseDown('start')}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#ffd60a] rounded-full border-2 border-[#1a1a1a]" />
            </div>

            <div
              className="absolute w-[3px] h-7 bg-[#ffd60a] cursor-ew-resize pointer-events-auto"
              style={{ left: `${endPercent}%` }}
              onMouseDown={handleMarkerMouseDown('end')}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#ffd60a] rounded-full border-2 border-[#1a1a1a]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
