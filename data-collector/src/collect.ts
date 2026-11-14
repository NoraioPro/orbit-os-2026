import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectCelestrak } from "./sources/celestrak.ts";
import { collectAsf } from "./sources/asf.ts";
import { collectCopernicus } from "./sources/copernicus.ts";
import { collectDonki } from "./sources/donki.ts";
import { collectEonet } from "./sources/eonet.ts";
import { collectEpic } from "./sources/epic.ts";
import { collectFirms } from "./sources/firms.ts";
import { collectGibs } from "./sources/gibs.ts";
import { collectOpenMeteo } from "./sources/openmeteo.ts";
import { collectPower } from "./sources/power.ts";
import { collectSwpc } from "./sources/swpc.ts";
import { collectUsgs } from "./sources/usgs.ts";
import { collectYr } from "./sources/yr.ts";
import {
  COLLECTOR_NAME,
  COLLECTOR_VERSION,
  type Manifest,
  type ManifestSource,
  type SourceResult,
} from "./types.ts";
import { isoNow, OUT_DIR, writeSourceFile } from "./util.ts";

type Collector = () => Promise<SourceResult>;

const COLLECTORS: { id: string; run: Collector }[] = [
  { id: "eonet", run: collectEonet },
  { id: "usgs", run: collectUsgs },
  { id: "nasa-power", run: collectPower },
  { id: "firms", run: collectFirms },
  { id: "swpc", run: collectSwpc },
  { id: "celestrak", run: collectCelestrak },
  { id: "donki", run: collectDonki },
  { id: "epic", run: collectEpic },
  { id: "gibs", run: collectGibs },
  { id: "yr", run: collectYr },
  { id: "openmeteo", run: collectOpenMeteo },
  { id: "copernicus", run: collectCopernicus },
  { id: "asf", run: collectAsf },
];

function formatResult(result: SourceResult): string {
  const range =
    result.time_range.start || result.time_range.end
      ? `${result.time_range.start ?? "?"} → ${result.time_range.end ?? "?"}`
      : "n/a";
  const err = result.errors.length > 0 ? `  errors=${result.errors.length}` : "";
  return `${result.id.padEnd(14)} ${result.status.padEnd(8)} records=${String(result.record_count ?? result.records.length).padStart(7)}  time=${range}${err}`;
}

async function runOne(fn: Collector, id: string): Promise<SourceResult> {
  const started = Date.now();
  process.stdout.write(`→ collecting ${id}...\n`);
  try {
    const result = await fn();
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(`  ${id} finished in ${elapsed}s [${result.status}] ${result.records.length} records\n`);
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        process.stdout.write(`    ! ${error}\n`);
      }
    }
    return result;
  } catch (error) {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(`  ${id} crashed in ${elapsed}s: ${String(error)}\n`);
    return {
      id,
      file: `${id}.json`,
      status: "failed",
      records: [],
      time_range: { start: null, end: null },
      errors: [String(error)],
      notes: ["Collector threw an unhandled exception; later sources still ran."],
    };
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const collectedAt = isoNow();
  const results: SourceResult[] = [];

  // Run sequentially so a rate-limited API cannot starve the rest, and so
  // DEMO_KEY / FIRMS / POWER requests stay polite. A failure never aborts the run.
  for (const collector of COLLECTORS) {
    const result = await runOne(collector.run, collector.id);
    results.push(result);
    try {
      await writeSourceFile(result);
    } catch (error) {
      result.errors.push(`Failed to write ${result.file}: ${String(error)}`);
      if (result.status === "ok") result.status = "partial";
    }
  }

  const manifest: Manifest = {
    collected_at: collectedAt,
    collector: COLLECTOR_NAME,
    version: COLLECTOR_VERSION,
    output_dir: OUT_DIR,
    sources: results.map(
      (r): ManifestSource => ({
        id: r.id,
        file: r.file,
        status: r.status,
        record_count: r.records.length,
        time_range: r.time_range,
        retrieved_at: collectedAt,
        errors: r.errors,
        notes: r.notes,
      }),
    ),
  };

  const manifestPath = path.join(OUT_DIR, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  process.stdout.write("\n=== ORBIT OS data collector summary ===\n");
  for (const result of results) {
    process.stdout.write(formatResult(result) + "\n");
  }
  const total = results.reduce((sum, r) => sum + r.records.length, 0);
  const failed = results.filter((r) => r.status === "failed" || r.status === "skipped");
  process.stdout.write(`\nTotal records: ${total}\n`);
  process.stdout.write(`Manifest: ${manifestPath}\n`);
  if (failed.length > 0) {
    process.stdout.write(`Sources with problems: ${failed.map((f) => `${f.id} (${f.status})`).join(", ")}\n`);
  }
}

main().catch((error) => {
  console.error("Collector aborted unexpectedly:", error);
  process.exitCode = 1;
});
