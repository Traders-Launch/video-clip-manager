export type SourceId = string;

export type ConnectorType = 'mock' | 'gdrive' | 's3';

export interface SourceMetadata {
  width?: number;
  height?: number;
  fps?: number;
  codecVideo?: string;
  codecAudio?: string;
  durationMs?: number;
}

export interface IngestSourceDraft {
  externalId: string;
  checksum: string;
  proxyUrl: string;
  fileName: string;
  name: string;
  durationSec: number;
  metadata?: SourceMetadata;
  isDuplicate?: boolean;
}

export interface VideoSource {
  id: SourceId;
  name: string;
  fileName: string;
  url: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  clipCounter: number;
  createdAt: number;
  origin?: 'local' | 'connector';
  hasPersistentFile?: boolean;
  connector?: ConnectorType;
  externalId?: string;
  checksum?: string;
  proxyUrl?: string;
  proxyReady?: boolean;
  metadata?: SourceMetadata;
  ingestJobId?: string;
  labels?: string[];
}

export interface AIMeta {
  confidence?: number;
  tags?: string[];
  summary?: string;
  transcriptSpan?: [number, number];
  model?: string;
}

export interface VideoSegment {
  start: number;
  end: number;
  sourceId?: SourceId;
  ai?: AIMeta;
}

export interface TextOverlay {
  content: string;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  fontWeight: string;
}

export interface Clip {
  id: number;
  name: string;
  sourceId: SourceId | null;
  segments: VideoSegment[];
  duration: number;
  isCombined: boolean;
  textOverlay: TextOverlay | null;
  isSuggested?: boolean;
}

export type VariationId = string;

export interface TransitionDef {
  kind: 'none' | 'fadeIn' | 'fadeOut' | 'crossfade';
  durationMs?: number;
}

export interface Variation {
  id: VariationId;
  clipId: number;
  templateId: string;
  prompt?: string;
  overlay: TextOverlay;
  transition?: TransitionDef;
  status: 'draft' | 'queued' | 'rendering' | 'ready' | 'failed';
  renderJobId?: string;
  outputUrl?: string;
  error?: string;
}

export interface VariationSet {
  clipId: number;
  items: Variation[];
  createdAt: number;
  prompt?: string;
}

export interface IngestJob {
  id: string;
  connector: ConnectorType;
  sourceIds: SourceId[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
  details?: string;
  error?: string;
}

export interface AISuggestedClip {
  id: string;
  sourceId: SourceId;
  segments: VideoSegment[];
  confidence: number;
  label?: string;
  summary?: string;
  tags?: string[];
}

export interface RenderJob {
  id: string;
  variationIds: VariationId[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  submittedAt: number;
  updatedAt: number;
  outputUrls?: string[];
  error?: string;
}

export type ViewMode = 'edit' | 'preview';
