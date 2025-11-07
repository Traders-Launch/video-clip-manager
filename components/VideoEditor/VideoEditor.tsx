'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Clip, ViewMode, TextOverlay, VideoSource, SourceId } from '@/types';
import VideoImport from './VideoImport';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import Controls from './Controls';
import ClipList from './ClipList';
import TextOverlayModal from './TextOverlayModal';
import VideoLibrary from './VideoLibrary';
import TutorialModal from './TutorialModal';

const LEGACY_STORAGE_KEY = 'video-clip-manager-clips';
const LEGACY_COUNTER_KEY = 'video-clip-manager-counter';
const STATE_KEY_V2 = 'video-clip-manager-state-v2';

interface PersistedStateV2 {
  version: 2;
  activeSourceId: SourceId | null;
  sources: Record<SourceId, VideoSource>;
  clips: Clip[];
}

interface LegacyStoredSegment {
  start: number;
  end: number;
}

type LegacyStoredClip = Omit<Clip, 'sourceId' | 'segments'> & {
  sourceId?: SourceId | null;
  segments?: LegacyStoredSegment[];
};

const defaultState: PersistedStateV2 = {
  version: 2,
  activeSourceId: null,
  sources: {},
  clips: [],
};

let cachedInitialState: PersistedStateV2 | null = null;
const getInitialState = (): PersistedStateV2 => {
  if (!cachedInitialState) {
    cachedInitialState =
      typeof window === 'undefined' ? defaultState : loadPersistedState();
  }
  return cachedInitialState;
};

const createSourceId = () =>
  `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/, '');

const revokeSourceUrl = (source?: VideoSource) => {
  if (source?.url && source.url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(source.url);
    } catch {
      // Ignore revoke errors (object URL might already be released)
    }
  }
};

const migrateLegacyState = (): PersistedStateV2 | null => {
  if (typeof window === 'undefined') return null;

  const savedClips = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!savedClips) return null;

  try {
    const rawClips = JSON.parse(savedClips) as LegacyStoredClip[];
    const counterRaw = localStorage.getItem(LEGACY_COUNTER_KEY);
    const clipCounter = counterRaw ? parseInt(counterRaw, 10) || 1 : 1;
    const sourceId = createSourceId();
    const now = Date.now();

    const syntheticSource: VideoSource = {
      id: sourceId,
      name: 'Legacy Import',
      fileName: 'Re-import required',
      url: '',
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      clipCounter,
      createdAt: now,
    };

    const upgradedClips: Clip[] = rawClips.map((clip) => ({
      ...clip,
      sourceId,
      segments: Array.isArray(clip.segments)
        ? clip.segments.map((segment) => ({
            start: Number(segment.start) || 0,
            end: Number(segment.end) || 0,
            sourceId,
          }))
        : [],
    }));

    const migrated: PersistedStateV2 = {
      version: 2,
      activeSourceId: upgradedClips.length ? sourceId : null,
      sources: upgradedClips.length ? { [sourceId]: syntheticSource } : {},
      clips: upgradedClips,
    };

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_COUNTER_KEY);
    localStorage.setItem(STATE_KEY_V2, JSON.stringify(migrated));
    return migrated;
  } catch (error) {
    console.error('Failed to migrate legacy state:', error);
    return null;
  }
};

const loadPersistedState = (): PersistedStateV2 => {
  if (typeof window === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STATE_KEY_V2);
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedStateV2;
      return {
        version: 2,
        activeSourceId: parsed.activeSourceId ?? null,
        sources: parsed.sources ?? {},
        clips: parsed.clips ?? [],
      };
    }
    const migrated = migrateLegacyState();
    if (migrated) {
      return migrated;
    }
  } catch (error) {
    console.error('Failed to load persisted editor state:', error);
  }

  return defaultState;
};

const getSegmentSourceId = (clip: Clip, segmentIndex = 0): SourceId | null => {
  const segment = clip.segments[segmentIndex];
  if (!segment) return clip.sourceId ?? null;
  return segment.sourceId ?? clip.sourceId ?? null;
};

export default function VideoEditor() {
  const [sources, setSources] = useState<Record<SourceId, VideoSource>>(
    () => getInitialState().sources
  );
  const [clips, setClips] = useState<Clip[]>(() => getInitialState().clips);
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(() => {
    const initial = getInitialState();
    if (initial.activeSourceId && initial.sources[initial.activeSourceId]) {
      return initial.activeSourceId;
    }
    return Object.keys(initial.sources)[0] ?? null;
  });
  const [selectedClips, setSelectedClips] = useState<Set<number>>(() => new Set());
  const [clipScope, setClipScope] = useState<'active' | 'all'>('active');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [currentPreviewClip, setCurrentPreviewClip] = useState<Clip | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [currentEditingClipId, setCurrentEditingClipId] = useState<number | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourcesRef = useRef<Record<SourceId, VideoSource>>({});
  const multiClipCounterRef = useRef<number>(
    getInitialState().clips.filter((clip) => clip.sourceId === null).length + 1
  );

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const selectActiveSource = (nextSourceId: SourceId | null) => {
    setActiveSourceId(nextSourceId);
    setViewMode('edit');
    setCurrentPreviewClip(null);
    setCurrentSegmentIndex(0);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: PersistedStateV2 = {
      version: 2,
      activeSourceId,
      sources,
      clips,
    };

    try {
      localStorage.setItem(STATE_KEY_V2, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist editor state:', error);
    }
  }, [sources, clips, activeSourceId]);

  useEffect(() => {
    return () => {
      Object.values(sourcesRef.current).forEach(revokeSourceUrl);
    };
  }, []);

  const activeSource = activeSourceId ? sources[activeSourceId] : null;
  const clipCountBySource = useMemo(() => {
    return clips.reduce<Record<SourceId, number>>((acc, clip) => {
      if (clip.sourceId) {
        acc[clip.sourceId] = (acc[clip.sourceId] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [clips]);
  const effectiveClipScope: 'active' | 'all' =
    clipScope === 'active' && !activeSourceId ? 'all' : clipScope;
  const displayedClips = useMemo(() => {
    if (effectiveClipScope === 'active') {
      if (!activeSourceId) return [];
      return clips.filter((clip) => clip.sourceId === activeSourceId);
    }
    return clips;
  }, [clips, activeSourceId, effectiveClipScope]);

  const addVideos = (files: File[]) => {
    if (!files.length) return;

    let lastAddedId: SourceId | null = null;
    const now = Date.now();

    setSources((prev) => {
      const next = { ...prev };
      files.forEach((file, index) => {
        const id = createSourceId();
        lastAddedId = id;
        next[id] = {
          id,
          name: stripExtension(file.name) || file.name,
          fileName: file.name,
          url: URL.createObjectURL(file),
          duration: 0,
          trimStart: 0,
          trimEnd: 0,
          clipCounter: 1,
          createdAt: now + index,
        };
      });
      return next;
    });

    if (lastAddedId) {
      selectActiveSource(lastAddedId);
    }
  };

  const removeSource = (sourceId: SourceId) => {
    const target = sources[sourceId];
    if (!target) return;

    const hasClips = clips.some((clip) => clip.sourceId === sourceId);
    const confirmed = confirm(
      hasClips
        ? 'Removing this video will also delete all of its clips. Continue?'
        : 'Remove this video source?'
    );
    if (!confirmed) return;

    revokeSourceUrl(target);
    const clipIdsToRemove = clips.filter((clip) => clip.sourceId === sourceId).map((clip) => clip.id);

    setSources((prev) => {
      const next = { ...prev };
      delete next[sourceId];
      return next;
    });
    setClips((prev) => prev.filter((clip) => clip.sourceId !== sourceId));
    setSelectedClips((prev) => {
      if (prev.size === 0 || clipIdsToRemove.length === 0) return prev;
      const next = new Set(prev);
      clipIdsToRemove.forEach((id) => next.delete(id));
      return next;
    });

    if (activeSourceId === sourceId) {
      const remainingIds = Object.keys(sources).filter((id) => id !== sourceId);
      selectActiveSource(remainingIds[0] ?? null);
    }
  };

  const clearAllClips = () => {
    if (!Object.keys(sources).length && clips.length === 0) return;

    if (
      confirm('This will remove all videos and clips from the editor. This action cannot be undone.')
    ) {
      Object.values(sources).forEach(revokeSourceUrl);
      setSources({});
      setClips([]);
      setSelectedClips(new Set());
      selectActiveSource(null);
      setClipScope('active');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STATE_KEY_V2);
      }
    }
  };

  const handleVideoMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const currentSrc = video.currentSrc || video.src;
    if (!currentSrc) return;

    const matchingSource = Object.values(sources).find((source) => source.url === currentSrc);
    if (!matchingSource) return;

    setSources((prev) => {
      const target = prev[matchingSource.id];
      if (!target) return prev;
      const nextTrimEnd = target.trimEnd === 0 ? duration : Math.min(target.trimEnd, duration);
      const nextTrimStart = Math.min(target.trimStart, nextTrimEnd);
      return {
        ...prev,
        [matchingSource.id]: {
          ...target,
          duration,
          trimStart: nextTrimStart,
          trimEnd: nextTrimEnd > 0 ? nextTrimEnd : duration,
        },
      };
    });
  };

  const setTrimStartForActive = (value: number) => {
    if (!activeSource) return;
    setSources((prev) => {
      const target = prev[activeSource.id];
      if (!target) return prev;
      const nextTrimStart = Math.max(0, Math.min(value, target.trimEnd));
      return {
        ...prev,
        [activeSource.id]: { ...target, trimStart: nextTrimStart },
      };
    });
  };

  const setTrimEndForActive = (value: number) => {
    if (!activeSource) return;
    setSources((prev) => {
      const target = prev[activeSource.id];
      if (!target) return prev;
      const upperBound =
        target.duration > 0 ? target.duration : Number.MAX_SAFE_INTEGER;
      const bounded = Math.min(Math.max(value, target.trimStart), upperBound);
      return {
        ...prev,
        [activeSource.id]: { ...target, trimEnd: bounded },
      };
    });
  };

  const createClip = () => {
    if (!activeSource || activeSource.duration === 0) return;
    const { trimStart, trimEnd, clipCounter, id: sourceId } = activeSource;
    const safeDuration = Math.max(0, trimEnd - trimStart);

    if (safeDuration === 0) return;

    const newClip: Clip = {
      id: Date.now(),
      name: `Clip ${clipCounter}`,
      sourceId,
      segments: [{ start: trimStart, end: trimEnd, sourceId }],
      duration: safeDuration,
      isCombined: false,
      textOverlay: null,
    };

    setClips((prev) => [...prev, newClip]);
    setSources((prev) => ({
      ...prev,
      [sourceId]: { ...prev[sourceId], clipCounter: clipCounter + 1 },
    }));
  };

  const deleteClip = (clipId: number) => {
    setClips((prev) => prev.filter((clip) => clip.id !== clipId));
    setSelectedClips((prev) => {
      if (!prev.has(clipId)) return prev;
      const next = new Set(prev);
      next.delete(clipId);
      return next;
    });
  };

  const duplicateClip = (clipId: number) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    const newClip: Clip = {
      ...clip,
      id: Date.now(),
      name: `${clip.name} (Copy)`,
      segments: JSON.parse(JSON.stringify(clip.segments)),
      textOverlay: clip.textOverlay ? JSON.parse(JSON.stringify(clip.textOverlay)) : null,
    };
    setClips((prev) => [...prev, newClip]);
  };

  const toggleClipSelection = (clipId: number) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    setSelectedClips((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const combineSelectedClips = () => {
    if (selectedClips.size < 2) return;

    const selectedIdSet = new Set(selectedClips);
    const selected = clips.filter((clip) => selectedIdSet.has(clip.id));

    if (selected.length < 2) return;

    const orderedSegments = selected.flatMap((clip) =>
      clip.segments.map((segment) => ({
        ...segment,
        sourceId: segment.sourceId ?? clip.sourceId ?? null,
      }))
    );

    if (!orderedSegments.length) return;

    const totalDuration = orderedSegments.reduce(
      (sum, segment) => sum + Math.max(0, segment.end - segment.start),
      0
    );

    if (totalDuration === 0) return;

    const uniqueSourceIds = Array.from(
      new Set(
        orderedSegments
          .map((segment) => segment.sourceId)
          .filter((value): value is SourceId => Boolean(value))
      )
    );

    let combinedName = 'Combined Clip';
    let combinedSourceId: SourceId | null = null;

    if (uniqueSourceIds.length === 1) {
      combinedSourceId = uniqueSourceIds[0] ?? null;
      const owningSource = combinedSourceId ? sources[combinedSourceId] : null;
      if (owningSource) {
        combinedName = `Combined ${owningSource.clipCounter}`;
      }
    } else {
      const multiCounter = multiClipCounterRef.current;
      combinedName = `Multi Combined ${multiCounter}`;
      multiClipCounterRef.current = multiCounter + 1;
    }

    const combined: Clip = {
      id: Date.now(),
      name: combinedName,
      sourceId: combinedSourceId,
      segments: orderedSegments,
      duration: totalDuration,
      isCombined: true,
      textOverlay: null,
    };

    setClips((prev) => [...prev, combined]);
    setSelectedClips(new Set());

    if (combinedSourceId) {
      setSources((prev) => {
        const target = prev[combinedSourceId as SourceId];
        if (!target) return prev;
        return {
          ...prev,
          [combinedSourceId]: {
            ...target,
            clipCounter: target.clipCounter + 1,
          },
        };
      });
    }
  };

  const previewClip = (clipId: number) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    const sourceId = getSegmentSourceId(clip);
    if (!sourceId) {
      alert('This clip is missing a source reference.');
      return;
    }

    const source = sources[sourceId];
    if (!source || !source.url) {
      alert('Source video is not available. Re-import the video to preview this clip.');
      return;
    }

    setCurrentPreviewClip(clip);
    setCurrentSegmentIndex(0);
    setViewMode('preview');
  };

  const exitPreviewMode = () => {
    setViewMode('edit');
    setCurrentPreviewClip(null);
    setCurrentSegmentIndex(0);

    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const openTextEditor = (clipId: number) => {
    setCurrentEditingClipId(clipId);
    setTextModalOpen(true);
  };

  const saveTextOverlay = (clipId: number, textOverlay: TextOverlay | null) => {
    setClips((prev) =>
      prev.map((clip) => (clip.id === clipId ? { ...clip, textOverlay } : clip))
    );
  };

  if (!Object.keys(sources).length) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl font-semibold m-0">Video Clip Manager</h1>
            <button
              onClick={() => setIsTutorialOpen(true)}
              className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
            >
              Tutorial
            </button>
          </div>
          <VideoImport onVideosLoad={addVideos} />
          <TutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-semibold m-0">Video Clip Manager</h1>
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
          >
            Tutorial
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <VideoLibrary
            sources={sources}
            activeSourceId={activeSourceId}
            clipCountBySource={clipCountBySource}
            onAddVideos={addVideos}
            onSelectSource={selectActiveSource}
            onRemoveSource={removeSource}
          />

          <div className="flex-1 flex flex-col gap-5">
            {activeSource ? (
              <>
                <div className="bg-[#2a2a2a] rounded-xl p-5">
                  <VideoPlayer
                    activeSource={activeSource}
                    sourcesById={sources}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    viewMode={viewMode}
                    currentPreviewClip={currentPreviewClip}
                    currentSegmentIndex={currentSegmentIndex}
                    onMetadataLoaded={handleVideoMetadata}
                    onSegmentChange={setCurrentSegmentIndex}
                  />

                  <Timeline
                    videoRef={videoRef}
                    trimStart={activeSource.trimStart}
                    trimEnd={activeSource.trimEnd}
                    viewMode={viewMode}
                    currentPreviewClip={currentPreviewClip}
                    currentSegmentIndex={currentSegmentIndex}
                    videoDuration={activeSource.duration}
                    onTrimStartChange={setTrimStartForActive}
                    onTrimEndChange={setTrimEndForActive}
                  />

                  <Controls
                    videoRef={videoRef}
                    trimStart={activeSource.trimStart}
                    trimEnd={activeSource.trimEnd}
                    viewMode={viewMode}
                    currentPreviewClip={currentPreviewClip}
                    videoDuration={viewMode === 'preview' && currentPreviewClip
                      ? currentPreviewClip.duration
                      : activeSource.duration}
                    currentSegmentIndex={currentSegmentIndex}
                    onSetTrimStart={() =>
                      setTrimStartForActive(videoRef.current?.currentTime || 0)
                    }
                    onSetTrimEnd={() =>
                      setTrimEndForActive(videoRef.current?.currentTime || 0)
                    }
                    onCreateClip={createClip}
                    onExitPreview={exitPreviewMode}
                  />
                </div>

                <ClipList
                  clips={displayedClips}
                  sources={sources}
                  activeSourceId={activeSourceId}
                  activeSourceName={activeSource?.name}
                  scope={effectiveClipScope}
                  hasActiveSource={Boolean(activeSourceId)}
                  selectedClips={selectedClips}
                  selectedCount={selectedClips.size}
                  onScopeChange={setClipScope}
                  onToggleSelection={toggleClipSelection}
                  onPreview={previewClip}
                  onDuplicate={duplicateClip}
                  onDelete={deleteClip}
                  onEditText={openTextEditor}
                  onCombineSelected={combineSelectedClips}
                  onClearAll={clearAllClips}
                />
              </>
            ) : (
              <div className="bg-[#2a2a2a] rounded-xl p-10 text-center text-[#bbb] min-h-[400px] flex flex-col items-center justify-center">
                <p className="text-lg font-semibold mb-2">Select a video to start editing</p>
                <p className="text-sm text-[#888]">
                  Use the Video Library to choose or add sources.
                </p>
              </div>
            )}
          </div>
        </div>

        <TextOverlayModal
          key={textModalOpen ? currentEditingClipId ?? 'new' : 'closed'}
          isOpen={textModalOpen}
          clipId={currentEditingClipId}
          clip={clips.find((clip) => clip.id === currentEditingClipId)}
          onClose={() => setTextModalOpen(false)}
          onSave={saveTextOverlay}
        />
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />
      </div>
    </div>
  );
}
