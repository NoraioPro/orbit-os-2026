/** Shared record and manifest types for the ORBIT OS data collector. */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface LiveRecord {
  id: string;
  source: string;
  type: string;
  title: string;
  lat: number | null;
  lon: number | null;
  time: string | null;
  values: Record<string, JsonValue>;
  units: Record<string, string>;
  url: string | null;
  status: "live";
  retrieved_at: string;
}

export interface TimeRange {
  start: string | null;
  end: string | null;
}

export interface SourceFile {
  source: string;
  retrieved_at: string;
  record_count: number;
  time_range: TimeRange;
  notes?: string[];
  extra?: Record<string, JsonValue>;
  records: LiveRecord[];
}

export type SourceStatus = "ok" | "partial" | "failed" | "skipped";

export interface ManifestSource {
  id: string;
  file: string;
  status: SourceStatus;
  record_count: number;
  time_range: TimeRange;
  retrieved_at: string | null;
  errors: string[];
  notes: string[];
}

export interface Manifest {
  collected_at: string;
  collector: string;
  version: string;
  output_dir: string;
  sources: ManifestSource[];
}

export interface SourceResult {
  id: string;
  file: string;
  status: SourceStatus;
  records: LiveRecord[];
  time_range: TimeRange;
  errors: string[];
  notes: string[];
  extra?: Record<string, JsonValue>;
}

export const COLLECTOR_NAME = "orbit-os-data-collector";
export const COLLECTOR_VERSION = "1.0.0";
export const USER_AGENT =
  "ORBIT-OS-DataCollector/1.0 (NASA Space Apps 2026; public-source harvest for hackathon demo)";
