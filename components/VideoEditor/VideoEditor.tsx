'use client';

import { useState, useRef, useEffect } from 'react';
import { Clip, ViewMode, TextOverlay } from '@/types';
import VideoImport from './VideoImport';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import Controls from './Controls';
import ClipList from './ClipList';
import TextOverlayModal from './TextOverlayModal';

const STORAGE_KEY = 'video-clip-manager-clips';
const COUNTER_KEY = 'video-clip-manager-counter';

export default function VideoEditor() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [clips, setClips] = useState<Clip[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const savedClips = localStorage.getItem(STORAGE_KEY);
      return savedClips ? JSON.parse(savedClips) : [];
    } catch (error) {
      console.error('Failed to load clips from localStorage:', error);
      return [];
    }
  });
  const [selectedClips, setSelectedClips] = useState<Set<number>>(new Set());
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [clipCounter, setClipCounter] = useState(() => {
    if (typeof window === 'undefined') {
      return 1;
    }

    try {
      const savedCounter = localStorage.getItem(COUNTER_KEY);
      return savedCounter ? parseInt(savedCounter, 10) || 1 : 1;
    } catch (error) {
      console.error('Failed to load clip counter from localStorage:', error);
      return 1;
    }
  });
  const [videoDuration, setVideoDuration] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [currentPreviewClip, setCurrentPreviewClip] = useState<Clip | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [currentEditingClipId, setCurrentEditingClipId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Save clips to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
      localStorage.setItem(COUNTER_KEY, clipCounter.toString());
    } catch (error) {
      console.error('Failed to save clips to localStorage:', error);
    }
  }, [clips, clipCounter]);

  const handleVideoLoad = (file: File) => {
    setVideoFile(file);
    // Note: We don't reset clips here anymore - they persist across videos
    setSelectedClips(new Set());
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setViewMode('edit');
    setCurrentPreviewClip(null);
  };

  const clearAllClips = () => {
    if (confirm('Are you sure you want to delete all clips? This cannot be undone.')) {
      setClips([]);
      setClipCounter(1);
      setSelectedClips(new Set());
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(COUNTER_KEY);
    }
  };

  const handleVideoMetadata = () => {
    if (videoRef.current) {
      const duration = Number.isFinite(videoRef.current.duration)
        ? videoRef.current.duration
        : 0;
      setTrimStart(0);
      setTrimEnd(duration);
      setVideoDuration(duration);
    }
  };

  const createClip = () => {
    const newClip: Clip = {
      id: Date.now(),
      name: `Clip ${clipCounter}`,
      segments: [{ start: trimStart, end: trimEnd }],
      duration: trimEnd - trimStart,
      isCombined: false,
      textOverlay: null,
    };
    setClips([...clips, newClip]);
    setClipCounter(clipCounter + 1);
  };

  const deleteClip = (clipId: number) => {
    setClips(clips.filter(c => c.id !== clipId));
    const newSelected = new Set(selectedClips);
    newSelected.delete(clipId);
    setSelectedClips(newSelected);
  };

  const duplicateClip = (clipId: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const newClip: Clip = {
      id: Date.now(),
      name: `${clip.name} (Copy)`,
      segments: JSON.parse(JSON.stringify(clip.segments)),
      duration: clip.duration,
      isCombined: clip.isCombined,
      textOverlay: clip.textOverlay ? JSON.parse(JSON.stringify(clip.textOverlay)) : null,
    };
    setClips([...clips, newClip]);
  };

  const toggleClipSelection = (clipId: number) => {
    const newSelected = new Set(selectedClips);
    if (newSelected.has(clipId)) {
      newSelected.delete(clipId);
    } else {
      newSelected.add(clipId);
    }
    setSelectedClips(newSelected);
  };

  const combineSelectedClips = () => {
    if (selectedClips.size < 2) return;

    const selectedClipObjs = Array.from(selectedClips)
      .map(id => clips.find(c => c.id === id))
      .filter((c): c is Clip => c !== undefined);

    // Sort by start time of first segment
    selectedClipObjs.sort((a, b) => a.segments[0].start - b.segments[0].start);

    // Combine all segments
    const allSegments = selectedClipObjs.flatMap(c => c.segments);
    const totalDuration = allSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);

    const combinedClip: Clip = {
      id: Date.now(),
      name: `Combined ${clipCounter}`,
      segments: allSegments,
      duration: totalDuration,
      isCombined: true,
      textOverlay: null,
    };

    setClips([...clips, combinedClip]);
    setClipCounter(clipCounter + 1);
    setSelectedClips(new Set());
  };

  const previewClip = (clipId: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    setCurrentPreviewClip(clip);
    setCurrentSegmentIndex(0);
    setViewMode('preview');

    // Start playing from first segment
    if (videoRef.current) {
      videoRef.current.currentTime = clip.segments[0].start;
      videoRef.current.play();
    }
  };

  const exitPreviewMode = () => {
    setViewMode('edit');
    setCurrentPreviewClip(null);
    setCurrentSegmentIndex(0);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const openTextEditor = (clipId: number) => {
    setCurrentEditingClipId(clipId);
    setTextModalOpen(true);
  };

  const saveTextOverlay = (clipId: number, textOverlay: TextOverlay | null) => {
    setClips(clips.map(clip =>
      clip.id === clipId
        ? { ...clip, textOverlay }
        : clip
    ));
  };

  if (!videoFile) {
    return <VideoImport onVideoLoad={handleVideoLoad} />;
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Video Clip Manager</h1>

        <div className="bg-[#2a2a2a] rounded-xl p-5 mb-5">
          <VideoPlayer
            videoFile={videoFile}
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
            trimStart={trimStart}
            trimEnd={trimEnd}
            viewMode={viewMode}
            currentPreviewClip={currentPreviewClip}
            currentSegmentIndex={currentSegmentIndex}
            videoDuration={videoDuration}
            onTrimStartChange={setTrimStart}
            onTrimEndChange={setTrimEnd}
          />

          <Controls
            videoRef={videoRef}
            trimStart={trimStart}
            trimEnd={trimEnd}
            viewMode={viewMode}
            currentPreviewClip={currentPreviewClip}
            videoDuration={videoDuration}
            currentSegmentIndex={currentSegmentIndex}
            onSetTrimStart={() => setTrimStart(videoRef.current?.currentTime || 0)}
            onSetTrimEnd={() => setTrimEnd(videoRef.current?.currentTime || 0)}
            onCreateClip={createClip}
            onExitPreview={exitPreviewMode}
          />
        </div>

        <ClipList
          clips={clips}
          selectedClips={selectedClips}
          onToggleSelection={toggleClipSelection}
          onPreview={previewClip}
          onDuplicate={duplicateClip}
          onDelete={deleteClip}
          onEditText={openTextEditor}
          onCombineSelected={combineSelectedClips}
          onClearAll={clearAllClips}
        />

        <TextOverlayModal
          key={textModalOpen ? currentEditingClipId ?? 'new' : 'closed'}
          isOpen={textModalOpen}
          clipId={currentEditingClipId}
          clip={clips.find(c => c.id === currentEditingClipId)}
          onClose={() => setTextModalOpen(false)}
          onSave={saveTextOverlay}
        />
      </div>
    </div>
  );
}
