'use client';

import { useEffect, useRef, RefObject, useCallback } from 'react';
import { Clip, ViewMode, VideoSource, SourceId } from '@/types';
import { hexToRgb } from '@/lib/utils';

interface VideoPlayerProps {
  activeSource: VideoSource | null;
  sourcesById: Record<SourceId, VideoSource>;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewMode: ViewMode;
  currentPreviewClip: Clip | null;
  currentSegmentIndex: number;
  onMetadataLoaded: () => void;
  onSegmentChange: (index: number) => void;
}

const getSegmentSourceId = (clip: Clip | null, segmentIndex: number): SourceId | null => {
  if (!clip) return null;
  const segment = clip.segments[segmentIndex] ?? clip.segments[0];
  if (!segment) return clip.sourceId ?? null;
  return segment.sourceId ?? clip.sourceId ?? null;
};

export default function VideoPlayer({
  activeSource,
  sourcesById,
  videoRef,
  canvasRef,
  viewMode,
  currentPreviewClip,
  currentSegmentIndex,
  onMetadataLoaded,
  onSegmentChange,
}: VideoPlayerProps) {
  const renderIntervalRef = useRef<number | null>(null);
  const loadedSourceIdRef = useRef<SourceId | null>(null);
  const pendingLoadHandlerRef = useRef<(() => void) | null>(null);

  const cleanupPendingLoadHandler = useCallback(() => {
    const video = videoRef.current;
    if (video && pendingLoadHandlerRef.current) {
      video.removeEventListener('loadeddata', pendingLoadHandlerRef.current);
      pendingLoadHandlerRef.current = null;
    }
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || viewMode !== 'edit') return;

    cleanupPendingLoadHandler();

    if (activeSource?.url) {
      if (loadedSourceIdRef.current !== activeSource.id) {
        video.pause();
        video.src = activeSource.url;
        loadedSourceIdRef.current = activeSource.id;
      }
    } else if (loadedSourceIdRef.current) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      loadedSourceIdRef.current = null;
    }
  }, [activeSource, viewMode, videoRef, cleanupPendingLoadHandler]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || viewMode !== 'preview' || !currentPreviewClip) return;

    const targetSourceId = getSegmentSourceId(currentPreviewClip, currentSegmentIndex);
    if (!targetSourceId) return;
    const source = sourcesById[targetSourceId];
    if (!source?.url) return;

    const segment = currentPreviewClip.segments[currentSegmentIndex] ?? currentPreviewClip.segments[0];
    if (!segment) return;

    const needsSwap = loadedSourceIdRef.current !== targetSourceId;

    if (needsSwap) {
      cleanupPendingLoadHandler();
      const handleLoadedData = () => {
        video.currentTime = segment.start;
        video.play();
        cleanupPendingLoadHandler();
      };
      pendingLoadHandlerRef.current = handleLoadedData;
      video.addEventListener('loadeddata', handleLoadedData);
      video.pause();
      video.src = source.url;
      loadedSourceIdRef.current = targetSourceId;
    } else {
      video.currentTime = segment.start;
      video.play();
    }

    return cleanupPendingLoadHandler;
  }, [
    viewMode,
    currentPreviewClip,
    currentSegmentIndex,
    sourcesById,
    videoRef,
    cleanupPendingLoadHandler,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (viewMode === 'preview' && currentPreviewClip) {
        const segment = currentPreviewClip.segments[currentSegmentIndex];
        if (!segment) return;

        if (video.currentTime >= segment.end) {
          const nextIndex = currentSegmentIndex + 1;
          if (nextIndex >= currentPreviewClip.segments.length) {
            onSegmentChange(0);
            const firstSegment = currentPreviewClip.segments[0];
            if (firstSegment) {
              const firstSourceId = getSegmentSourceId(currentPreviewClip, 0);
              if (firstSourceId && firstSourceId === loadedSourceIdRef.current) {
                video.currentTime = firstSegment.start;
              }
            }
          } else {
            const nextSegment = currentPreviewClip.segments[nextIndex];
            const nextSourceId = nextSegment.sourceId ?? currentPreviewClip.sourceId ?? null;
            const currentSourceId = segment.sourceId ?? currentPreviewClip.sourceId ?? null;

            onSegmentChange(nextIndex);
            if (nextSourceId && currentSourceId === nextSourceId) {
              video.currentTime = nextSegment.start;
            }
          }
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, viewMode, currentPreviewClip, currentSegmentIndex, onSegmentChange]);

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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
