import { Clip, SourceId, VideoSource } from '@/types';
import { drawTextOverlay } from './textOverlay';

const MIME_TYPE_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp8',
  'video/webm',
];

const DEFAULT_FPS = 30;
const EPSILON = 0.01;

interface ResolvedSegment {
  start: number;
  end: number;
  source: VideoSource;
}

export interface ClipExportOptions {
  includeTextOverlay?: boolean;
  fps?: number;
}

const getSupportedMimeType = () => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return null;
  }

  for (const type of MIME_TYPE_CANDIDATES) {
    if (window.MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
};

const resolveSegments = (
  clip: Clip,
  sources: Record<SourceId, VideoSource>
): ResolvedSegment[] => {
  const segments = clip.segments
    .map((segment) => {
      const sourceId = segment.sourceId ?? clip.sourceId;
      if (!sourceId) {
        throw new Error('Clip segment is missing a video source.');
      }

      const source = sources[sourceId];
      if (!source?.url) {
        throw new Error('One of the clip sources is unavailable. Re-import the video first.');
      }

      const start = Math.max(0, Number(segment.start) || 0);
      const end = Math.max(start, Number(segment.end) || 0);

      if (end - start <= EPSILON) {
        return null;
      }

      return { start, end, source };
    })
    .filter((segment): segment is ResolvedSegment => Boolean(segment));

  if (!segments.length) {
    throw new Error('This clip has no playable segments.');
  }

  return segments;
};

const ensureVideoSource = (video: HTMLVideoElement, url: string) => {
  if (video.src === url && video.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Failed to load video source for export.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('error', handleError);

    if (video.src !== url) {
      video.pause();
      video.src = url;
    } else {
      video.load();
    }
  });
};

const seekTo = (video: HTMLVideoElement, time: number) => {
  if (Math.abs(video.currentTime - time) <= EPSILON) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Unable to seek within the source video.'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
    video.currentTime = time;
  });
};

const waitForSegmentEnd = (video: HTMLVideoElement, endTime: number) => {
  return new Promise<void>((resolve, reject) => {
    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime - EPSILON) {
        cleanup();
        resolve();
      }
    };
    const handleEnded = () => {
      if (video.currentTime >= endTime - EPSILON || video.ended) {
        cleanup();
        resolve();
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Video playback failed during export.'));
    };
    const cleanup = () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
  });
};

const collectRecording = (recorder: MediaRecorder, fallbackType: string) => {
  return new Promise<Blob>((resolve, reject) => {
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || fallbackType }));
    };
    recorder.onerror = (event) => {
      reject(event.error ?? new Error('Failed to export clip.'));
    };
  });
};

const startRenderLoop = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  overlay: Clip['textOverlay'] | null
) => {
  let rafId: number | null = null;

  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (video.videoWidth && video.videoHeight) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    if (overlay) {
      drawTextOverlay(ctx, canvas, overlay);
    }

    rafId = window.requestAnimationFrame(render);
  };

  render();

  return () => {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }
  };
};

export async function exportClipToBlob(
  clip: Clip,
  sources: Record<SourceId, VideoSource>,
  options: ClipExportOptions = {}
) {
  if (typeof window === 'undefined') {
    throw new Error('Clip downloads are only available in the browser.');
  }

  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  const segments = resolveSegments(clip, sources);
  const includeTextOverlay = options.includeTextOverlay ?? true;
  const fps = options.fps ?? DEFAULT_FPS;

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create drawing surface for export.');
  }

  const canvasStream = canvas.captureStream?.(fps);
  if (!canvasStream) {
    throw new Error('Canvas streaming is not supported in this browser.');
  }

  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false;
  video.volume = 0;

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  const audioContext = AudioCtx ? new AudioCtx() : null;
  if (audioContext) {
    await audioContext.resume().catch(() => undefined);
  }

  const mediaStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((track) => mediaStream.addTrack(track));

  let sourceNode: MediaElementAudioSourceNode | null = null;
  if (audioContext) {
    sourceNode = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    sourceNode.connect(destination);
    const [audioTrack] = destination.stream.getAudioTracks();
    if (audioTrack) {
      mediaStream.addTrack(audioTrack);
    } else {
      console.warn('The selected clip has no audio track.');
    }
  } else {
    console.warn('AudioContext unavailable. Exported clip will be muted.');
  }

  const recorder = new window.MediaRecorder(mediaStream, { mimeType });
  const recordingPromise = collectRecording(recorder, mimeType);
  const stopRenderLoop = startRenderLoop(
    video,
    canvas,
    ctx,
    includeTextOverlay ? clip.textOverlay : null
  );

  recorder.start();

  try {
    for (const segment of segments) {
      await ensureVideoSource(video, segment.source.url);

      const targetWidth = video.videoWidth || segment.source.metadata?.width || canvas.width;
      const targetHeight = video.videoHeight || segment.source.metadata?.height || canvas.height;
      if (
        targetWidth &&
        targetHeight &&
        (canvas.width !== targetWidth || canvas.height !== targetHeight)
      ) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const safeEnd =
        video.duration && Number.isFinite(video.duration)
          ? Math.min(segment.end, video.duration)
          : segment.end;

      await seekTo(video, segment.start);
      try {
        await video.play();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Unable to start playback while exporting clip: ${reason}`);
      }
      await waitForSegmentEnd(video, safeEnd);
      video.pause();
    }
  } finally {
    stopRenderLoop();

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    mediaStream.getTracks().forEach((track) => track.stop());
    if (sourceNode) {
      sourceNode.disconnect();
    }
    if (audioContext) {
      audioContext.close().catch(() => undefined);
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  return recordingPromise;
}
