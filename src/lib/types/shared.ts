export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type AsyncNullable<T> = Promise<Nullable<T>>;

export type AsyncOptional<T> = Promise<Optional<T>>;

export type ComponentMessage = { type: string; source: string; data?: unknown; timestamp: number };

export type HistoryState<T> = { past: T[]; present: T; future: T[] };

export type View = "composer" | "player" | "sequencer" | "visualizer";

export type UIState = {
  isInitialized: boolean;
  selectedPreset?: string;
  activeView: View;
  isRecording: boolean;
  showSettings: boolean;
};
