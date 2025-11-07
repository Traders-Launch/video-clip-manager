export type SourceId = string;

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
}

export interface VideoSegment {
  start: number;
  end: number;
  sourceId?: SourceId;
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
}

export type ViewMode = 'edit' | 'preview';
