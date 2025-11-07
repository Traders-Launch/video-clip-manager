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
  ingestJobs: {},
  suggestionIndex: {},
  variationIndex: {},
  renderJobs: {},
};

let cachedInitialState: PersistedState | null = null;
const getInitialState = (): PersistedState => {
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
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(() => {
    if (initialState.activeSourceId && initialState.sources[initialState.activeSourceId]) {
      return initialState.activeSourceId;
    }
    return Object.keys(initialState.sources)[0] ?? null;
  });
  const [selectedClips, setSelectedClips] = useState<Set<number>>(() => new Set());
  const [clipScope, setClipScope] = useState<'active' | 'all'>('active');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [currentPreviewClip, setCurrentPreviewClip] = useState<Clip | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [currentEditingClipId, setCurrentEditingClipId] = useState<number | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [ingestJobs, setIngestJobs] = useState<Record<string, PersistedIngestJob>>(
    () => initialState.ingestJobs
  );
  const [suggestionsBySource, setSuggestionsBySource] = useState<
    Record<SourceId, AISuggestedClip[]>
  >({});
  const [variationSets, setVariationSets] = useState<Record<number, VariationSet>>({});
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJob>>(() => {
    const persisted = initialState.renderJobs;
    return Object.fromEntries(
      Object.entries(persisted).map(([id, job]) => [
        id,
        {
          ...job,
        } as RenderJob,
      ])
    );
  });
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isRenderDrawerOpen, setIsRenderDrawerOpen] = useState(false);
  const [variationTargetClipId, setVariationTargetClipId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourcesRef = useRef<Record<SourceId, VideoSource>>({});
  const multiClipCounterRef = useRef<number>(
    initialState.clips.filter((clip) => clip.sourceId === null).length + 1
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

    const duration = suggestion.segments.reduce(
      (sum, segment) => sum + Math.max(0, segment.end - segment.start),
      0
    );

    const newClip: Clip = {
      id: Date.now(),
      name: `AI Clip ${(sources[sourceId]?.clipCounter ?? 0) + 1}`,
      sourceId,
      segments: suggestion.segments,
      duration,
      isCombined: suggestion.segments.length > 1,
      textOverlay: null,
    };

    setClips((prev) => [...prev, newClip]);
    setSources((prev) => {
      const target = prev[sourceId];
      if (!target) return prev;
      return {
        ...prev,
        [sourceId]: {
          ...target,
          clipCounter: target.clipCounter + 1,
        },
      };
    });
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
              >
                Connect &amp; Ingest
              </button>
              <button
                onClick={() => setIsRenderDrawerOpen(true)}
                className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
              >
                Render Queue
              </button>
              <button
                onClick={() => setIsTutorialOpen(true)}
                className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
              >
                Tutorial
              </button>
            </div>
          </div>
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
            >
              Auto-Mine Shots
            </button>
            <button
              onClick={() => setIsRenderDrawerOpen(true)}
              className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
            >
              Render Queue
            </button>
            <button
              onClick={() => setIsTutorialOpen(true)}
              className="bg-[#444] text-white border border-[#555] px-4 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
            >
              Tutorial
            </button>
          </div>
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
                  onScopeChange={setClipScope}
                  onToggleSelection={toggleClipSelection}
                  onPreview={previewClip}
                  onDuplicate={duplicateClip}
                  onDelete={deleteClip}
                  onEditText={openTextEditor}
                  onOpenVariations={openVariationPanelFor}
                  onCombineSelected={combineSelectedClips}
                  onClearAll={clearAllClips}
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
