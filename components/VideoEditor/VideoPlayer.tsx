'use client';

import { useEffect, useRef, RefObject } from 'react';
import { Clip, ViewMode } from '@/types';
import { hexToRgb } from '@/lib/utils';

interface VideoPlayerProps {
  videoFile: File;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  viewMode: ViewMode;
  currentPreviewClip: Clip | null;
  currentSegmentIndex: number;
  onMetadataLoaded: () => void;
  onSegmentChange: (index: number) => void;
}

export default function VideoPlayer({
  videoFile,
  videoRef,
  canvasRef,
  viewMode,
  currentPreviewClip,
  currentSegmentIndex,
  onMetadataLoaded,
  onSegmentChange,
}: VideoPlayerProps) {
  const renderIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (videoRef.current && videoFile) {
      const url = URL.createObjectURL(videoFile);
      videoRef.current.src = url;

      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (viewMode === 'preview' && currentPreviewClip) {
        const segment = currentPreviewClip.segments[currentSegmentIndex];

        // Check if we need to move to next segment
        if (video.currentTime >= segment.end) {
          const nextIndex = currentSegmentIndex + 1;
          if (nextIndex >= currentPreviewClip.segments.length) {
            // Loop back to start
            onSegmentChange(0);
            video.currentTime = currentPreviewClip.segments[0].start;
          } else {
            // Move to next segment
            onSegmentChange(nextIndex);
            video.currentTime = currentPreviewClip.segments[nextIndex].start;
          }
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoRef, viewMode, currentPreviewClip, currentSegmentIndex, onSegmentChange]);

  // Canvas rendering for text overlays
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const shouldShowCanvas = viewMode === 'preview' && currentPreviewClip?.textOverlay;

    if (shouldShowCanvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.classList.add('block');
      video.classList.add('hidden');

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const render = () => {
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw text overlay
        if (currentPreviewClip?.textOverlay) {
          drawTextOverlay(ctx, canvas, currentPreviewClip.textOverlay);
        }

        renderIntervalRef.current = requestAnimationFrame(render);
      };

      render();
    } else {
      canvas.classList.remove('block');
      canvas.classList.add('hidden');
      video.classList.remove('hidden');

      if (renderIntervalRef.current) {
        cancelAnimationFrame(renderIntervalRef.current);
        renderIntervalRef.current = null;
      }
    }

    return () => {
      if (renderIntervalRef.current) {
        cancelAnimationFrame(renderIntervalRef.current);
        renderIntervalRef.current = null;
      }
    };
  }, [videoRef, canvasRef, viewMode, currentPreviewClip]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        controls
        onLoadedMetadata={onMetadataLoaded}
        className="w-full max-h-[500px] bg-black rounded-lg"
      />
      <canvas
        ref={canvasRef}
        className="w-full max-h-[500px] bg-black rounded-lg hidden absolute top-0 left-0"
      />
    </div>
  );
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  textOverlay: NonNullable<Clip['textOverlay']>
) {
  const { content, position, fontSize, textColor, bgColor, bgOpacity, fontWeight } = textOverlay;

  ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = content.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  let startY: number;
  if (position === 'top') {
    startY = totalHeight / 2 + 40;
  } else if (position === 'bottom') {
    startY = canvas.height - totalHeight / 2 - 40;
  } else {
    startY = canvas.height / 2;
  }

  lines.forEach((line, index) => {
    const y = startY + (index - (lines.length - 1) / 2) * lineHeight;
    const textMetrics = ctx.measureText(line);
    const textWidth = textMetrics.width;
    const padding = 20;

    // Draw background
    const bgAlpha = bgOpacity / 100;
    const rgb = hexToRgb(bgColor);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${bgAlpha})`;
    ctx.fillRect(
      canvas.width / 2 - textWidth / 2 - padding,
      y - fontSize / 2 - padding / 2,
      textWidth + padding * 2,
      lineHeight
    );

    // Draw text
    ctx.fillStyle = textColor;
    ctx.fillText(line, canvas.width / 2, y);
  });
}
