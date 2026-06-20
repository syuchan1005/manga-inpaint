export interface HistoryItem {
  id: string;
  originalSrc: string;
  resultSrc: string;
  maskSrc?: string;
  timestamp: number;
  precision: "fp16" | "fp32";
  targetSize: number;
  inferenceMode: "single" | "patch";
  inferenceTimeMs: number | null;
}
