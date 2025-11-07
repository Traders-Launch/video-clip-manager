'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  AISuggestedClip,
  Clip,
  IngestJob,
  IngestSourceDraft,
  RenderJob,
  SourceId,
  TextOverlay,
  VariationSet,
  VideoSource,
  ViewMode,
} from '@/types';
import { createRenderJob, generateVariations, listRenderJobs, runShotMiner } from '@/lib/client/api';
import { exportClipToBlob } from '@/lib/exportClip';
import VideoImport from './VideoImport';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import Controls from './Controls';
import ClipList from './ClipList';
import TextOverlayModal from './TextOverlayModal';
import VideoLibrary from './VideoLibrary';
import TutorialModal from './TutorialModal';
import IngestConnectModal from '../Automations/IngestConnectModal';
import SuggestedClipsPanel from '../Automations/SuggestedClipsPanel';
import VariationPanel from '../Automations/VariationPanel';
import RenderQueueDrawer from '../Automations/RenderQueueDrawer';
import { clearAll as clearVideoStore, deleteFile, getFile, saveFile } from '@/lib/storage/videoStore';

const LEGACY_STORAGE_KEY = 'video-clip-manager-clips';
const LEGACY_COUNTER_KEY = 'video-clip-manager-counter';
const STATE_KEY_V2 = 'video-clip-manager-state-v2';
const STATE_KEY_V3 = 'video-clip-manager-state-v3';

interface PersistedStateV2 {
  version: 2;
  activeSourceId: SourceId | null;
  sources: Record<SourceId, VideoSource>;
  clips: Clip[];
}

type PersistedIngestJob = Pick<
  IngestJob,
  'id' | 'status' | 'progress' | 'connector' | 'sourceIds'
>;

type PersistedRenderJob = Pick<
  RenderJob,
  'id' | 'status' | 'progress' | 'variationIds' | 'submittedAt' | 'updatedAt'
>;

interface PersistedStateV3 {
  version: 3;
  activeSourceId: SourceId | null;
  sources: Record<SourceId, VideoSource>;
  clips: Clip[];
  globalClipCounter: number;
  ingestJobs: Record<string, PersistedIngestJob>;
  suggestionIndex: Record<
    SourceId,
    {
      count: number;
      lastUpdated: number;
    }
  >;
  variationIndex: Record<
    number,
    {
      count: number;
      lastUpdated: number;
    }
  >;
  renderJobs: Record<string, PersistedRenderJob>;
}

type PersistedState = PersistedStateV3;

interface LegacyStoredSegment {
  start: number;
  end: number;
}

type LegacyStoredClip = Omit<Clip, 'sourceId' | 'segments'> & {
  sourceId?: SourceId | null;
  segments?: LegacyStoredSegment[];
};

const defaultState: PersistedState = {
  version: 3,
  activeSourceId: null,
  sources: {},
  clips: [],
  globalClipCounter: 1,
  ingestJobs: {},
  suggestionIndex: {},
  variationIndex: {},
  renderJobs: {},
};

let cachedInitialState: PersistedState | null = null;
const getInitialState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return defaultState;
  }
  if (!cachedInitialState) {
    cachedInitialState = loadPersistedState();
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

const loadPersistedStateV2 = (): PersistedStateV2 | null => {
  if (typeof window === 'undefined') return null;

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

  return null;
};

const migrateV2ToV3 = (state: PersistedStateV2): PersistedState => ({
  version: 3,
  activeSourceId: state.activeSourceId,
  sources: state.sources,
  clips: state.clips,
  globalClipCounter: state.clips.length + 1,
  ingestJobs: {},
  suggestionIndex: {},
  variationIndex: {},
  renderJobs: {},
});

const loadPersistedState = (): PersistedState => {
  if (typeof window === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STATE_KEY_V3);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PersistedState>;
      return {
        ...defaultState,
        ...parsed,
        version: 3,
      };
    }

    const legacyV2 = loadPersistedStateV2();
    if (legacyV2) {
      const migrated = migrateV2ToV3(legacyV2);
      try {
        localStorage.setItem(STATE_KEY_V3, JSON.stringify(migrated));
      } catch (error) {
        console.error('Failed to persist migrated state:', error);
      }
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
  const initialState = getInitialState();
  const [sources, setSources] = useState<Record<SourceId, VideoSource>>(
    () => initialState.sources
  );
  const [clips, setClips] = useState<Clip[]>(() => initialState.clips);
  const [globalClipCounter, setGlobalClipCounter] = useState<number>(
    () => initialState.globalClipCounter
  );
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(
    () => initialState.activeSourceId
  );
  const [selectedClips, setSelectedClips] = useState<Set<number>>(() => new Set());
  const [clipScope, setClipScope] = useState<'active' | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [currentPreviewClip, setCurrentPreviewClip] = useState<Clip | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [currentEditingClipId, setCurrentEditingClipId] = useState<number | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [ingestJobs, setIngestJobs] = useState<Record<string, PersistedIngestJob>>(
    () => defaultState.ingestJobs
  );
  const [suggestionsBySource, setSuggestionsBySource] = useState<
    Record<SourceId, AISuggestedClip[]>
  >({});
  const [variationSets, setVariationSets] = useState<Record<number, VariationSet>>({});
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJob>>(() => defaultState.renderJobs);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isRenderDrawerOpen, setIsRenderDrawerOpen] = useState(false);
  const [variationTargetClipId, setVariationTargetClipId] = useState<number | null>(null);
  const [downloadingClipId, setDownloadingClipId] = useState<number | null>(null);
  const [isRestoringSources, setIsRestoringSources] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourcesRef = useRef<Record<SourceId, VideoSource>>({});
  const multiClipCounterRef = useRef<number>(1);
  const hasHydratedStateRef = useRef(false);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const persistVideoFile = useCallback(
    async (sourceId: SourceId, file: File) => {
      try {
        await saveFile(sourceId, file);
        setSources((prev) => {
          const target = prev[sourceId];
          if (!target || target.hasPersistentFile) {
            return prev;
          }
          return {
            ...prev,
            [sourceId]: {
              ...target,
              hasPersistentFile: true,
            },
          };
        });
      } catch (error) {
        console.error('Failed to persist video file', error);
        setPersistenceWarning(
          'Browser blocked persistent storage. Imported videos may disappear after refresh.'
        );
      }
    },
    [setSources, setPersistenceWarning]
  );

  const restorePersistedVideos = useCallback(async (snapshot: Record<SourceId, VideoSource>) => {
    const candidates = Object.values(snapshot).filter(
      (source) => source.hasPersistentFile && !source.url
    );
    if (!candidates.length) return;

    setIsRestoringSources(true);

    try {
      await Promise.all(
        candidates.map(async (source) => {
          try {
            const file = await getFile(source.id);
            if (!file) {
              setSources((prev) => {
                const target = prev[source.id];
                if (!target) return prev;
                return {
                  ...prev,
                  [source.id]: { ...target, hasPersistentFile: false },
                };
              });
              setPersistenceWarning(
                'Some videos were cleared from browser storage. Re-import them to keep editing.'
              );
              return;
            }

            const objectUrl = URL.createObjectURL(file);
            setSources((prev) => {
              const target = prev[source.id];
              if (!target) return prev;
              revokeSourceUrl(target);
              return {
                ...prev,
                [source.id]: {
                  ...target,
                  url: objectUrl,
                },
              };
            });
          } catch (error) {
            console.error(`Failed to restore video ${source.id}`, error);
            setPersistenceWarning(
              'Unable to restore some videos from storage. Re-import them to keep editing.'
            );
          }
        })
      );
    } finally {
      setIsRestoringSources(false);
    }
  }, [setSources, setPersistenceWarning, setIsRestoringSources]);

  useEffect(() => {
    if (hasHydratedStateRef.current) return;
    if (typeof window === 'undefined') return;

    const persisted = loadPersistedState();
    hasHydratedStateRef.current = true;

    if (persisted === defaultState) {
      multiClipCounterRef.current = 1;
      return;
    }

    const sanitizedSources = Object.fromEntries(
      Object.entries(persisted.sources).map(([id, source]) => {
        const shouldResetUrl =
          source.hasPersistentFile ||
          (source.url.startsWith('blob:') && source.origin !== 'connector');
        if (shouldResetUrl) {
          return [
            id,
            {
              ...source,
              url: '',
            },
          ];
        }
        return [id, source];
      })
    ) as Record<SourceId, VideoSource>;

    setSources(sanitizedSources);
    setClips(persisted.clips);

    const nextActiveId =
      (persisted.activeSourceId && sanitizedSources[persisted.activeSourceId]
        ? persisted.activeSourceId
        : Object.keys(sanitizedSources)[0]) ?? null;
    setActiveSourceId(nextActiveId);
    setIngestJobs(persisted.ingestJobs);

    const hydratedRenderJobs = Object.fromEntries(
      Object.entries(persisted.renderJobs).map(([id, job]) => [
        id,
        {
          ...job,
        } as RenderJob,
      ])
    );
    setRenderJobs(hydratedRenderJobs);

    multiClipCounterRef.current =
      persisted.clips.filter((clip) => clip.sourceId === null).length + 1;

    restorePersistedVideos(sanitizedSources);
  }, [restorePersistedVideos]);

  const selectActiveSource = (nextSourceId: SourceId | null) => {
    setActiveSourceId(nextSourceId);
    setViewMode('edit');
    setCurrentPreviewClip(null);
    setCurrentSegmentIndex(0);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasHydratedStateRef.current) return;
    const suggestionIndex = Object.fromEntries(
      Object.entries(suggestionsBySource).map(([sourceId, items]) => [
        sourceId,
        { count: items.length, lastUpdated: Date.now() },
      ])
    );
    const variationIndex = Object.fromEntries(
      Object.entries(variationSets).map(([clipId, set]) => [
        Number(clipId),
        { count: set.items.length, lastUpdated: set.createdAt },
      ])
    );
    const compactRenderJobs = Object.fromEntries(
      Object.entries(renderJobs).map(([id, job]) => [
        id,
        {
          id: job.id,
          status: job.status,
          progress: job.progress,
          variationIds: job.variationIds,
          submittedAt: job.submittedAt,
          updatedAt: job.updatedAt,
        },
      ])
    );
    const payload: PersistedState = {
      version: 3,
      activeSourceId,
      sources,
      clips,
      globalClipCounter,
      ingestJobs,
      suggestionIndex,
      variationIndex,
      renderJobs: compactRenderJobs,
    };

    try {
      localStorage.setItem(STATE_KEY_V3, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist editor state:', error);
    }
  }, [
    activeSourceId,
    sources,
    clips,
    globalClipCounter,
    ingestJobs,
    suggestionsBySource,
    variationSets,
    renderJobs,
  ]);

  useEffect(() => {
    return () => {
      Object.values(sourcesRef.current).forEach(revokeSourceUrl);
    };
  }, []);

  const activeSource = activeSourceId ? sources[activeSourceId] : null;
  const isPlaybackLocked = isRestoringSources || !activeSource?.url;
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

  const variationTargetClip =
    variationTargetClipId !== null
      ? clips.find((clip) => clip.id === variationTargetClipId) ?? null
      : null;
  const variationTargetItems =
    variationTargetClipId !== null
      ? variationSets[variationTargetClipId]?.items ?? []
      : [];

  const addVideos = (files: File[]) => {
    if (!files.length) return;

    const now = Date.now();
    const newEntries = files.map((file, index) => ({
      id: createSourceId(),
      file,
      createdAt: now + index,
    }));

    setSources((prev) => {
      const next = { ...prev };
      newEntries.forEach(({ id, file, createdAt }) => {
        next[id] = {
          id,
          name: stripExtension(file.name) || file.name,
          fileName: file.name,
          url: URL.createObjectURL(file),
          duration: 0,
          trimStart: 0,
          trimEnd: 0,
          clipCounter: 1,
          createdAt,
          origin: 'local',
          hasPersistentFile: false,
        };
      });
      return next;
    });

    newEntries.forEach(({ id, file }) => {
      persistVideoFile(id, file);
    });

    if (newEntries.length) {
      selectActiveSource(newEntries[newEntries.length - 1].id);
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
    if (target.hasPersistentFile) {
      deleteFile(target.id).catch((error) => {
        console.error(`Failed to remove persisted video ${target.id}`, error);
      });
    }
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
      setGlobalClipCounter(1);
      setSelectedClips(new Set());
      selectActiveSource(null);
      setClipScope('all');
      setPersistenceWarning(null);
      setIsRestoringSources(false);
      clearVideoStore().catch((error) => {
        console.error('Failed to clear persisted videos', error);
      });
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STATE_KEY_V2);
        localStorage.removeItem(STATE_KEY_V3);
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
    const { trimStart, trimEnd, id: sourceId, name: sourceName } = activeSource;
    const safeDuration = Math.max(0, trimEnd - trimStart);

    if (safeDuration === 0) return;

    const videoBaseName = stripExtension(sourceName);
    const clipName = `${videoBaseName}-${globalClipCounter}`;

    const newClip: Clip = {
      id: Date.now(),
      name: clipName,
      sourceId,
      segments: [{ start: trimStart, end: trimEnd, sourceId }],
      duration: safeDuration,
      isCombined: false,
      textOverlay: null,
    };

    setClips((prev) => [...prev, newClip]);
    setGlobalClipCounter((prev) => prev + 1);
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

  const downloadClip = async (clipId: number) => {
    if (downloadingClipId !== null) {
      if (downloadingClipId !== clipId) {
        alert('Please wait for the current download to finish.');
      }
      return;
    }

    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    try {
      setDownloadingClipId(clipId);
      const blob = await exportClipToBlob(clip, sources);

      const safeName =
        clip.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'clip';
      const fileName = `${safeName}-${clip.id}.webm`;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
    } catch (error) {
      console.error('Failed to download clip', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to export the clip in this browser.';
      alert(message);
    } finally {
      setDownloadingClipId((current) => (current === clipId ? null : current));
    }
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
        sourceId: segment.sourceId ?? clip.sourceId ?? undefined,
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

    let combinedName = `combined-${globalClipCounter}`;
    let combinedSourceId: SourceId | null = null;

    if (uniqueSourceIds.length === 1) {
      combinedSourceId = uniqueSourceIds[0] ?? null;
      const owningSource = combinedSourceId ? sources[combinedSourceId] : null;
      if (owningSource) {
        const videoBaseName = stripExtension(owningSource.name);
        combinedName = `${videoBaseName}-${globalClipCounter}`;
      }
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
    setGlobalClipCounter((prev) => prev + 1);
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

  const handleIngestCompleted = (drafts: IngestSourceDraft[], job: IngestJob) => {
    const existingChecksums = new Set(
      Object.values(sources)
        .map((source) => source.checksum)
        .filter((checksum): checksum is string => Boolean(checksum))
    );

    const newSources: Record<SourceId, VideoSource> = {};
    const createdSourceIds: SourceId[] = [];

    drafts.forEach((draft) => {
      if (!draft.proxyUrl || !draft.checksum || existingChecksums.has(draft.checksum)) {
        return;
      }
      const id = createSourceId();
      existingChecksums.add(draft.checksum);
      createdSourceIds.push(id);
      newSources[id] = {
        id,
        name: draft.name,
        fileName: draft.fileName,
        url: draft.proxyUrl,
        proxyUrl: draft.proxyUrl,
        proxyReady: true,
        duration: draft.durationSec,
        trimStart: 0,
        trimEnd: draft.durationSec,
        clipCounter: 1,
        createdAt: Date.now(),
        origin: 'connector',
        connector: job.connector,
        externalId: draft.externalId,
        checksum: draft.checksum,
        metadata: draft.metadata,
        ingestJobId: job.id,
      };
    });

    if (Object.keys(newSources).length) {
      setSources((prev) => ({ ...prev, ...newSources }));
      if (createdSourceIds[0]) {
        selectActiveSource(createdSourceIds[0]);
      }
    }

    setIngestJobs((prev) => ({
      ...prev,
      [job.id]: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        connector: job.connector,
        sourceIds: createdSourceIds,
      },
    }));
    setIsIngestModalOpen(false);
  };

  const runShotMiningForActive = async () => {
    if (!activeSource) {
      alert('Select a source before running the Shot Miner.');
      return;
    }
    const proxy = activeSource.proxyUrl ?? activeSource.url;
    if (!proxy) {
      alert('This source is missing a playable proxy.');
      return;
    }

    try {
      const { suggestions } = await runShotMiner({
        sourceId: activeSource.id,
        proxyUrl: proxy,
        mode: 'fast',
      });
      setSuggestionsBySource((prev) => ({ ...prev, [activeSource.id]: suggestions }));
    } catch (error) {
      console.error('Shot miner failed', error);
      alert('Failed to generate suggestions. Try again in a moment.');
    }
  };

  const acceptSuggestion = (sourceId: SourceId, suggestionId: string) => {
    const suggestions = suggestionsBySource[sourceId];
    const suggestion = suggestions?.find((item) => item.id === suggestionId);
    if (!suggestion) return;

    const source = sources[sourceId];
    const videoBaseName = source ? stripExtension(source.name) : 'ai-clip';
    const clipName = `${videoBaseName}-${globalClipCounter}`;

    const duration = suggestion.segments.reduce(
      (sum, segment) => sum + Math.max(0, segment.end - segment.start),
      0
    );

    const newClip: Clip = {
      id: Date.now(),
      name: clipName,
      sourceId,
      segments: suggestion.segments,
      duration,
      isCombined: suggestion.segments.length > 1,
      textOverlay: null,
    };

    setClips((prev) => [...prev, newClip]);
    setGlobalClipCounter((prev) => prev + 1);
    setSuggestionsBySource((prev) => ({
      ...prev,
      [sourceId]: (prev[sourceId] ?? []).filter((item) => item.id !== suggestionId),
    }));
  };

  const discardSuggestion = (sourceId: SourceId, suggestionId: string) => {
    setSuggestionsBySource((prev) => ({
      ...prev,
      [sourceId]: (prev[sourceId] ?? []).filter((item) => item.id !== suggestionId),
    }));
  };

  const openVariationPanelFor = (clipId: number) => {
    setVariationTargetClipId(clipId);
  };

  const closeVariationPanel = () => setVariationTargetClipId(null);

  const generateVariationsFor = async (
    clipId: number,
    args: { prompt?: string; templateIds: string[]; count?: number }
  ) => {
    const targetClip = clips.find((clip) => clip.id === clipId);
    if (!targetClip) return;

    try {
      const { variationSet } = await generateVariations({
        clip: targetClip,
        prompt: args.prompt,
        templateIds: args.templateIds,
        count: args.count,
      });
      setVariationSets((prev) => ({ ...prev, [clipId]: variationSet }));
    } catch (error) {
      console.error('Failed to generate variations', error);
      alert('Unable to generate variations right now.');
    }
  };

  const queueRenderFor = async (variationIds: string[]) => {
    if (!variationIds.length) return;
    try {
      const { job } = await createRenderJob({ variationIds });
      setRenderJobs((prev) => ({ ...prev, [job.id]: job }));
      setIsRenderDrawerOpen(true);
    } catch (error) {
      console.error('Failed to queue render job', error);
      alert('Unable to queue render job at the moment.');
    }
  };

  const refreshRenderJobs = useCallback(async () => {
    try {
      const { jobs } = await listRenderJobs();
      setRenderJobs((prev) => {
        const next = { ...prev };
        jobs.forEach((job) => {
          next[job.id] = job;
        });
        return next;
      });
    } catch (error) {
      console.error('Failed to refresh render jobs', error);
    }
  }, []);

  useEffect(() => {
    if (!isRenderDrawerOpen) return;
    const interval = setInterval(() => {
      refreshRenderJobs();
    }, 2500);
    return () => clearInterval(interval);
  }, [isRenderDrawerOpen, refreshRenderJobs]);

  const renderPersistenceAlerts = () => {
    if (!isRestoringSources && !persistenceWarning) return null;
    return (
      <div className="space-y-2 mb-4">
        {isRestoringSources && (
          <div className="rounded-lg border border-[#0a84ff] bg-[#0a84ff]/10 px-4 py-3 text-sm text-[#dbe9ff]">
            Restoring imported videos from browser storage…
          </div>
        )}
        {persistenceWarning && (
          <div className="rounded-lg border border-[#ff9f0a] bg-[#ff9f0a]/10 px-4 py-3 text-sm text-[#ffd699]">
            {persistenceWarning}
          </div>
        )}
      </div>
    );
  };

  const statusCallout = (
    <div className="bg-[#1f1f1f] border border-[#333] rounded-xl p-4 text-sm text-[#ddd] mt-4">
      <p className="text-xs uppercase tracking-[0.3em] text-[#777] mb-3">
        Live demo status
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#30d158]">
            Works today
          </span>
          <ul className="mt-2 space-y-1 text-xs text-[#bbb] list-disc list-inside">
            <li>Mock connector ingest, AI shot miner, variation templates, and render queue.</li>
            <li>All data stays in your browser/localStorage—no uploads leave the page.</li>
          </ul>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#ff9f0a]">
            Coming soon
          </span>
          <ul className="mt-2 space-y-1 text-xs text-[#bbb] list-disc list-inside">
            <li>Real cloud connectors (Drive/S3) plus background workers backed by Redis/SQS.</li>
            <li>GPU render farm + shared team storage using the env vars noted in `.env.example`.</li>
          </ul>
        </div>
      </div>
    </div>
  );

  if (!Object.keys(sources).length) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl font-semibold m-0">Video Clip Manager</h1>
            <div
              className="flex flex-wrap items-center gap-2"
              data-tour-id="automations"
            >
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="bg-[#0a84ff] text-white border-none px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#0066cc] transition-all"
                title="Uses the mock connector + local storage in this demo build"
              >
                Connect &amp; Ingest
              </button>
              <button
                onClick={() => setIsRenderDrawerOpen(true)}
                className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
                title="Shows placeholder outputs generated locally"
              >
                Render Queue
              </button>
              <button
                onClick={() => setIsTutorialOpen(true)}
                className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
                title="Overview + guided tour (notes on what’s live vs coming)"
              >
                Tutorial
              </button>
            </div>
          </div>
          {statusCallout}
          {renderPersistenceAlerts()}
          <VideoImport onVideosLoad={addVideos} />
          <TutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
          <IngestConnectModal
            isOpen={isIngestModalOpen}
            onClose={() => setIsIngestModalOpen(false)}
            onIngestCompleted={handleIngestCompleted}
          />
          <RenderQueueDrawer
            isOpen={isRenderDrawerOpen}
            jobs={Object.values(renderJobs)}
            onClose={() => setIsRenderDrawerOpen(false)}
            onRefresh={refreshRenderJobs}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-semibold m-0">Video Clip Manager</h1>
          <div
            className="flex flex-wrap items-center gap-2"
            data-tour-id="automations"
          >
            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="bg-[#0a84ff] text-white border-none px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#0066cc] transition-all"
              title="Uses the mock connector + local storage in this demo build"
            >
              Connect &amp; Ingest
            </button>
            <button
              onClick={runShotMiningForActive}
              disabled={!activeSource}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                activeSource
                  ? 'bg-[#444] text-white border-[#555] hover:bg-[#555]'
                  : 'bg-[#333] text-[#777] border-[#444] cursor-not-allowed'
              }`}
              title="Runs the mocked AI shot miner locally"
            >
              Auto-Mine Shots
            </button>
            <button
              onClick={() => setIsRenderDrawerOpen(true)}
              className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
              title="Placeholder render jobs with fake download URLs for now"
            >
              Render Queue
            </button>
            <button
              onClick={() => setIsTutorialOpen(true)}
              className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
              title="Overview + guided tour (notes on what’s live vs coming)"
            >
              Tutorial
            </button>
          </div>
        </div>
        {statusCallout}
        {renderPersistenceAlerts()}

        <div className="flex flex-col lg:flex-row gap-6">
          <VideoLibrary
            sources={sources}
            activeSourceId={activeSourceId}
            clipCountBySource={clipCountBySource}
            onAddVideos={addVideos}
            onSelectSource={selectActiveSource}
            onRemoveSource={removeSource}
            isRestoring={isRestoringSources}
          />

          <div className="flex-1 flex flex-col gap-5">
            {activeSource ? (
              <>
                <div className="bg-[#2a2a2a] rounded-xl p-5" data-tour-id="player">
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
                    isPlaybackLocked={isPlaybackLocked}
                    isRestoring={isRestoringSources}
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
                    disabled={isPlaybackLocked}
                  />
                </div>
                {activeSourceId &&
                  (suggestionsBySource[activeSourceId]?.length ?? 0) > 0 && (
                    <SuggestedClipsPanel
                      sourceId={activeSourceId}
                      suggestions={suggestionsBySource[activeSourceId]!}
                      onAccept={(id) => acceptSuggestion(activeSourceId, id)}
                      onDiscard={(id) => discardSuggestion(activeSourceId, id)}
                    />
                  )}
                <ClipList
                  clips={displayedClips}
                  sources={sources}
                  activeSourceId={activeSourceId}
                  activeSourceName={activeSource?.name}
                  scope={effectiveClipScope}
                  hasActiveSource={Boolean(activeSourceId)}
                  selectedClips={selectedClips}
                  selectedCount={selectedClips.size}
                  downloadingClipId={downloadingClipId}
                  onScopeChange={setClipScope}
                  onToggleSelection={toggleClipSelection}
                  onPreview={previewClip}
                  onDuplicate={duplicateClip}
                  onDelete={deleteClip}
                  onEditText={openTextEditor}
                  onOpenVariations={openVariationPanelFor}
                  onCombineSelected={combineSelectedClips}
                  onClearAll={clearAllClips}
                  onDownload={downloadClip}
                />
              </>
            ) : (
              <div
                className="bg-[#2a2a2a] rounded-xl p-10 text-center text-[#bbb] min-h-[400px] flex flex-col items-center justify-center"
                data-tour-id="player"
              >
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
        <IngestConnectModal
          isOpen={isIngestModalOpen}
          onClose={() => setIsIngestModalOpen(false)}
          onIngestCompleted={handleIngestCompleted}
        />
        <RenderQueueDrawer
          isOpen={isRenderDrawerOpen}
          jobs={Object.values(renderJobs)}
          onClose={() => setIsRenderDrawerOpen(false)}
          onRefresh={refreshRenderJobs}
        />
        {variationTargetClipId !== null && (
          <VariationPanel
            clip={variationTargetClip}
            variations={variationTargetItems}
            onGenerate={(args) => generateVariationsFor(variationTargetClipId!, args)}
            onQueueRender={queueRenderFor}
            onClose={closeVariationPanel}
          />
        )}
      </div>
    </div>
  );
}
