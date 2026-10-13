import { islandLink } from "./config.ts"
import type { Entry } from "./page.ts"

/** Which builder wrote the catalog: Guildhall's commit and when the bundle was built. */
export interface BuilderInfo {
  /** The Guildhall commit builder/chronicle.js was bundled from. */
  commit: string
  /** The bundle's build time (ISO 8601). */
  built: string
  /** Present (true) when the bundle was built from uncommitted sources, so the commit alone doesn't reproduce it. */
  dirty?: true
}

/**
 * Reads the banner scripts/chronicle-build.ts puts on the bundle:
 *   // Source: https://github.com/Codestz/guildhall/blob/<sha>/[legacy/]scripts/chronicle.ts[ (plus uncommitted changes)]
 *   // Built: <ISO time>
 * Undefined when the banner isn't there.
 */
export function builderOf(bundle: string): BuilderInfo | undefined {
  const head = bundle.split("\n", 12).join("\n")
  const source = /^\/\/ Source: \S*\/blob\/([0-9a-f]{7,40})\/\S+(\s+\(plus uncommitted changes\))?$/m.exec(head)
  const built = /^\/\/ Built: (\S+)$/m.exec(head)
  if (!source?.[1] || !built?.[1]) return undefined
  return { commit: source[1], built: built[1], ...(source[2] ? { dirty: true as const } : {}) }
}

export const CATALOG_START = "<!-- catalog:start -->"
export const CATALOG_END = "<!-- catalog:end -->"

/** A value in a table cell: no pipes, no line breaks, no markup from the repo's own text. */
function cell(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[\\|<>[\]`*_]/g, (c) => `\\${c}`).trim()
}

function size(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** The catalog as a Markdown table, in index order (by stars). Same input, same bytes. */
export function catalogTable(repos: readonly Entry[]): string {
  const rows = repos.map((e) => {
    const years = e.years[0] === e.years[1] ? `${e.years[0]}` : `${e.years[0]}–${e.years[1]}`
    return [
      `[${cell(e.repo)}](https://github.com/${e.repo})`,
      cell(e.description ?? ""),
      e.stars === undefined ? "" : e.stars.toLocaleString("en"),
      years,
      e.files.toLocaleString("en"),
      size(e.bytes),
      `[island](${islandLink(e.repo)})`,
    ].join(" | ")
  })
  return [
    "| Repo | About | Stars | Years | Files | Size | Island |",
    "| --- | --- | ---: | --- | ---: | ---: | --- |",
    ...rows.map((r) => `| ${r} |`),
  ].join("\n")
}

/** `readme` with what sits between the catalog markers replaced; throws when the markers are missing. */
export function spliceCatalog(readme: string, table: string): string {
  const start = readme.indexOf(CATALOG_START)
  const end = readme.indexOf(CATALOG_END)
  if (start < 0 || end < start) throw new Error(`README.md needs ${CATALOG_START} … ${CATALOG_END}`)
  return `${readme.slice(0, start + CATALOG_START.length)}\n${table}\n${readme.slice(end)}`
}
