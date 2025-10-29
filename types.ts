export interface Slide {
  id: number;
  english: string;
  hindi: string;
  imageUrl: string | null;
  script: string;
  audioData: string | null;
}

export type GenerationState = 'idle' | 'processing' | 'translating' | 'explaining' | 'imaging' | 'narrating' | 'done' | 'error';
export type LessonState = 'idle' | 'playing' | 'paused' | 'finished';
export type RecordingState = 'idle' | 'recording' | 'stopped';

export interface GenerationProgress {
  current: number;
  total: number;
  step: string;
}