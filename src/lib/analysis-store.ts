import { useSyncExternalStore } from "react";

export type PoseLandmark = { x: number; y: number; v?: number };
export type PoseFrame = { frame: number; landmarks: PoseLandmark[] };

export type AnalysisResult = {
  joint_angles?: {
    elbow?: number;
    front_knee?: number;
    rear_knee?: number;
    trunk?: number;
  };
  alignment?: {
    shoulder?: string;
    hip?: string;
  };
  score?: number;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  frames?: PoseFrame[];
};

type State = {
  result: AnalysisResult | null;
  videoUrl: string | null;
  fileName: string | null;
};

let state: State = { result: null, videoUrl: null, fileName: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setAnalysis(next: State) {
  if (state.videoUrl && state.videoUrl !== next.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
  }
  state = next;
  emit();
}

export function clearAnalysis() {
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state = { result: null, videoUrl: null, fileName: null };
  emit();
}

export function useAnalysis(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => ({ result: null, videoUrl: null, fileName: null }),
  );
}

const API_KEY = "bowlingai_api_url";
export const DEFAULT_API_URL = "http://localhost:8000";

export function getApiUrl(): string {
  if (typeof window === "undefined") return DEFAULT_API_URL;
  return window.localStorage.getItem(API_KEY) || DEFAULT_API_URL;
}

export function saveApiUrl(url: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(API_KEY, url);
}


