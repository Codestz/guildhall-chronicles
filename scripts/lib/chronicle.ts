import { gunzipSync } from "node:zlib"

/**
 * The parts of a Guildhall chronicle (format v1, guildhall's world/chronicle/format.ts) that the
 * card and pages read. The builder (builder/chronicle.js) owns the format; this only reads it.
 */

export interface ChronicleView {
  v: 1
  generatedAt: string
  /** Whole days since 1970-01-01 UTC. */
  start: number
  end: number
  repo: {
    name: string
    description?: string
    stars?: number
    languages: [string, number][]
    files: number
    bytes: number
  }
  /** Districts: per-sample file counts (the last is today's), main language. */
  units: { name: string; language: string; files: number[]; died?: number }[]
}

export function readChronicle(bytes: Uint8Array): ChronicleView {
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString("utf8") : new TextDecoder().decode(bytes)
  const c = JSON.parse(text) as Partial<ChronicleView>
  if (c.v !== 1 || !c.repo || typeof c.repo.name !== "string" || !Array.isArray(c.units))
    throw new Error("not a v1 chronicle")
  return c as ChronicleView
}

/** The year a Day falls in. */
export function yearOf(day: number): number {
  return new Date(day * 86_400_000).getUTCFullYear()
}

/** Districts alive today, biggest first, with today's file count. */
export function districts(c: ChronicleView): { name: string; language: string; files: number }[] {
  return c.units
    .map((unit) => ({ name: unit.name, language: unit.language, files: unit.files.at(-1) ?? 0 }))
    .filter((unit) => unit.files > 0)
    .sort((a, b) => b.files - a.files)
}
