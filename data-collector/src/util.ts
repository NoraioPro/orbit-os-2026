import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JsonValue, LiveRecord, SourceFile, SourceResult, TimeRange } from "./types.ts";

export const OUT_DIR = path.resolve(process.cwd(), "out");

export function isoNow(): string {
  return new Date().toISOString();
}

export function utcDaysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export function ymdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ymdCompact(d: Date): string {
  return ymdUTC(d).replaceAll("-", "");
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** NASA POWER and similar APIs use a fill value (typically -999) for missing observations. */
export function numericOrNull(value: unknown, fillValue = -999): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  if (n === fillValue) return null;
  return n;
}

export function timeRangeOf(records: LiveRecord[]): TimeRange {
  const times = records
    .map((r) => r.time)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .sort();
  if (times.length === 0) return { start: null, end: null };
  return { start: times[0], end: times[times.length - 1] };
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length === 1 && cells[0] === "") continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = cells[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

/** Best-effort point from GeoJSON-like geometry. Coordinates are [lon, lat, ...]. */
export function pointFromGeometry(geometry: unknown): { lat: number | null; lon: number | null } {
  if (!geometry || typeof geometry !== "object") return { lat: null, lon: null };
  const g = geometry as { type?: string; coordinates?: unknown };
  return pointFromCoordinates(g.coordinates);
}

export function pointFromCoordinates(coordinates: unknown): { lat: number | null; lon: number | null } {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return { lat: null, lon: null };
  // Point: [lon, lat]
  if (typeof coordinates[0] === "number") {
    return { lon: toNumber(coordinates[0]), lat: toNumber(coordinates[1]) };
  }
  // Polygon / Multi*: flatten first ring / first position
  let cursor: unknown = coordinates;
  while (Array.isArray(cursor) && cursor.length > 0 && Array.isArray(cursor[0])) {
    cursor = cursor[0];
  }
  if (Array.isArray(cursor) && typeof cursor[0] === "number") {
    return { lon: toNumber(cursor[0]), lat: toNumber(cursor[1]) };
  }
  return { lat: null, lon: null };
}

export async function writeSourceFile(result: SourceResult): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const payload: SourceFile = {
    source: result.id,
    retrieved_at: isoNow(),
    record_count: result.records.length,
    time_range: result.time_range,
    notes: result.notes.length > 0 ? result.notes : undefined,
    extra: result.extra,
    records: result.records,
  };
  const filePath = path.join(OUT_DIR, result.file);
  // Compact JSON for large feeds; still valid and easy to stream later.
  await writeFile(filePath, JSON.stringify(payload), "utf8");
}

export function emptyResult(id: string, file: string, status: SourceResult["status"], errors: string[], notes: string[] = []): SourceResult {
  return {
    id,
    file,
    status,
    records: [],
    time_range: { start: null, end: null },
    errors,
    notes,
  };
}

export function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function record(partial: Omit<LiveRecord, "status" | "retrieved_at"> & { retrieved_at: string }): LiveRecord {
  return { ...partial, status: "live" };
}

export function extraCount(label: string, value: JsonValue): Record<string, JsonValue> {
  return { [label]: value };
}
