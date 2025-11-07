export interface VideoSegment {
  start: number;
  end: number;
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
  segments: VideoSegment[];
  duration: number;
  isCombined: boolean;
  textOverlay: TextOverlay | null;
}

export type ViewMode = 'edit' | 'preview';
