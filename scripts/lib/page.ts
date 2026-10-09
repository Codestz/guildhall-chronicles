import { escapeXml as escape } from "./card.ts"
import { HALL, islandLink, PAGES, previewLink, slugOf } from "./config.ts"

/**
 * The Pages site's pages (site/): one per chronicle at r/<owner>/<name>/, whose only job is to carry
 * the island's Open Graph tags (the hall is a static SPA, so it can't have per-repo tags without an
 * edge function) and then send people on to the island. Unfurlers don't run scripts, so they read
 * the tags; people's browsers do, so they go on to the hall. No meta refresh: some crawlers follow
 * it and would read the hall's tags instead.
 */

/** A catalog entry as index.json writes it (guildhall's world/chronicle/catalog.ts). */
export interface Entry {
  repo: string
  description?: string
  stars?: number
  languages: string[]
  years: [number, number]
  files: number
  bytes: number
  built: string
}

export interface Catalog {
  v: 1
  updated: string
  repos: Entry[]
}

/** The page's path under site/, lower case (Pages paths are case-sensitive; links are made here). */
export function pagePath(repo: string): string {
  return `r/${repo.toLowerCase()}/index.html`
}

export function describe(entry: Entry): string {
  const years = entry.years[0] === entry.years[1] ? `${entry.years[0]}` : `${entry.years[0]}–${entry.years[1]}`
  const facts = `${years}, ${entry.files.toLocaleString("en")} files${entry.languages.length ? `, mostly ${entry.languages.join(", ")}` : ""}.`
  return `${entry.description ? `${entry.description} ` : ""}Its whole history as a voxel island: ${facts}`
}

export function previewPage(entry: Entry): string {
  const island = islandLink(entry.repo)
  const title = `${entry.repo} as an island · Guildhall`
  const image = `${PAGES}/og/${slugOf(entry.repo)}.png`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(describe(entry))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Guildhall">
<meta property="og:url" content="${escape(previewLink(entry.repo))}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(describe(entry))}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(`${entry.repo}'s districts as hex cells, coloured by language, beside its name.`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#15110d">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#15110d;color:#f3e9d4;font:18px/1.5 system-ui,sans-serif}a{color:#f1d590}</style>
<script>location.replace(${JSON.stringify(island).replace(/</g, "\\u003c")})</script>
</head>
<body>
<p>Sailing to <a href="${escape(island)}">${escape(entry.repo)}'s island</a>…</p>
</body>
</html>
`
}

/** site/index.html: the Harbour lives in the hall. */
export function rootPage(): string {
  const harbour = `${HALL}/harbour`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Guildhall chronicles</title>
<link rel="canonical" href="${harbour}">
<script>location.replace("${harbour}")</script>
</head>
<body><p>The chronicled repos are in <a href="${harbour}">the Harbour</a>.</p></body>
</html>
`
}
