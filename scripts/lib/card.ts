import { type ChronicleView, districts, yearOf } from "./chronicle.ts"

/**
 * A repo's preview card (1200×630, the size every unfurler wants) as SVG: on the left its island,
 * hex cells for its districts coloured by language as the hall colours them, raised a little like
 * the hall's voxels; on the right its name, description and numbers. og.ts rasterises it with resvg.
 *
 * Why not a screenshot of the real island: Actions runners have no GPU, so the hall would render in
 * software WebGL (SwiftShader) at seconds a frame, and it would also need the live site and GitHub's
 * unauthenticated API (60 calls an hour, shared by every job on the runner's IP). This card needs
 * only the chronicle, and is the same bytes every time.
 */

export const WIDTH = 1200
export const HEIGHT = 630

/** The hall's language accents (guildhall's world/gen/biomes.ts, GitHub linguist's colours). */
const LANGUAGE: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Java: "#b07219",
  Kotlin: "#a97bff",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Markdown: "#083fa1",
  MDX: "#fcb32c",
  JSON: "#292929",
  YAML: "#cb171e",
  Dart: "#00b4ab",
  Lua: "#000080",
  Zig: "#ec915c",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  glTF: "#7a8f4b",
  Image: "#a0a0a0",
}
const OTHER = "#8a8a8a"

export function colourOf(language: string): string {
  return LANGUAGE[language] ?? OTHER
}

/** FNV-1a: the same island for the same repo, every build. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0) / 0xffffffff
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** 250753 → "251k". */
export function compact(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
}

/** Words into at most `lines` lines of about `width` characters, the last cut with an ellipsis. */
export function wrap(text: string, width: number, lines: number): string[] {
  const out: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = out.at(-1)
    if (last !== undefined && `${last} ${word}`.length <= width) out[out.length - 1] = `${last} ${word}`
    else out.push(word.length > width ? `${word.slice(0, width - 1)}…` : word)
  }
  if (out.length <= lines) return out
  const kept = out.slice(0, lines)
  kept[lines - 1] = `${(kept[lines - 1] as string).slice(0, width - 1).trimEnd()}…`
  return kept
}

interface Cell {
  q: number
  r: number
  colour: string
  lift: number
}

/** The island's cells: an organic blob of `count` hexes, its districts as wedges round the root's middle. */
export function islandCells(c: ChronicleView): Cell[] {
  const all = districts(c)
  const files = all.reduce((sum, d) => sum + d.files, 0)
  const count = Math.round(Math.min(110, Math.max(36, 30 + 14 * Math.log10(files + 1))))
  const seed = c.repo.name.toLowerCase()

  const candidates: { q: number; r: number; score: number }[] = []
  for (let q = -8; q <= 8; q++)
    for (let r = -8; r <= 8; r++) {
      const ring = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2
      if (ring > 8) continue
      candidates.push({ q, r, score: ring + hash(`${seed}:${q},${r}`) * 2.2 })
    }
  const cells = candidates.sort((a, b) => a.score - b.score).slice(0, count)

  // The root's own files ("/") in the middle; every other district a wedge round it, as wide as the
  // square root of its files (cell i of n goes to the district whose running share holds (i + ½) / n).
  const root = all.find((d) => d.name === "/")
  const ring = all.filter((d) => d !== root)
  const weigh = (d: { files: number }) => Math.sqrt(d.files)
  const total = all.reduce((sum, d) => sum + weigh(d), 0) || 1
  const middle = new Set(cells.slice(0, root ? Math.round((weigh(root) / total) * count) : 0))
  const around = cells.filter((cell) => !middle.has(cell)).sort((a, b) => angle(a) - angle(b))
  const ringTotal = ring.reduce((sum, d) => sum + weigh(d), 0) || 1
  const bounds: number[] = []
  let running = 0
  for (const d of ring) bounds.push((running += weigh(d) / ringTotal))
  const colourAt = (i: number): string => {
    const at = (i + 0.5) / around.length
    const k = bounds.findIndex((bound) => at <= bound)
    return colourOf(ring[k < 0 ? ring.length - 1 : k]?.language ?? "Other")
  }

  return cells.map((cell) => {
    const lift = 8 + Math.round(hash(`${seed}:lift:${cell.q},${cell.r}`) * 10)
    if (middle.has(cell)) return { q: cell.q, r: cell.r, colour: colourOf(root?.language ?? "Other"), lift: lift + 6 }
    return { q: cell.q, r: cell.r, colour: colourAt(around.indexOf(cell)), lift }
  })
}

function angle(cell: { q: number; r: number }): number {
  return Math.atan2(1.5 * cell.r, Math.sqrt(3) * (cell.q + cell.r / 2))
}

/** A colour lightened (amount > 0) or darkened (< 0), -1…1. */
function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix)
  return `#${(((r as number) << 16) | ((g as number) << 8) | (b as number)).toString(16).padStart(6, "0")}`
}

function islandSvg(c: ChronicleView): string {
  const size = 23
  const squash = 0.6
  const [cx, cy] = [310, 330]
  const corners = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30)
    return [Math.cos(a) * size, Math.sin(a) * size * squash] as const
  })
  const placed = islandCells(c).map((cell) => ({
    ...cell,
    x: size * Math.sqrt(3) * (cell.q + cell.r / 2),
    y: size * 1.5 * cell.r * squash,
  }))
  // Centred on the sea, whichever way the coast happened to grow.
  const mid = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2
  const [mx, my] = [mid(placed.map((p) => p.x)), mid(placed.map((p) => p.y))]
  const cells = placed
    .map((cell) => ({ ...cell, x: cell.x - mx + cx, y: cell.y - my + cy }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const parts = cells.map((cell) => {
    const top = corners.map(([dx, dy]) => `${(cell.x + dx).toFixed(1)},${(cell.y + dy - cell.lift).toFixed(1)}`)
    // The three lower edges, dropped to the water: the cell's side.
    const side = corners.slice(0, 4)
    const wall = [
      ...side.map(([dx, dy]) => `${(cell.x + dx).toFixed(1)},${(cell.y + dy - cell.lift).toFixed(1)}`),
      ...[...side].reverse().map(([dx, dy]) => `${(cell.x + dx).toFixed(1)},${(cell.y + dy + 6).toFixed(1)}`),
    ]
    return `<polygon points="${wall.join(" ")}" fill="${shade(cell.colour, -0.45)}"/><polygon points="${top.join(" ")}" fill="${shade(cell.colour, 0.12)}" stroke="${shade(cell.colour, -0.25)}" stroke-width="1"/>`
  })
  return [
    `<ellipse cx="${cx}" cy="${cy + 22}" rx="250" ry="122" fill="url(#sea)"/>`,
    `<ellipse cx="${cx}" cy="${cy + 14}" rx="214" ry="96" fill="none" stroke="#dcb662" stroke-opacity="0.18" stroke-width="2"/>`,
    ...parts,
  ].join("")
}

/** The whole card, as SVG text. */
export function cardSvg(c: ChronicleView): string {
  const [owner = "", name = ""] = c.repo.name.split("/")
  const nameSize = Math.round(Math.min(64, Math.max(34, 520 / (name.length * 0.62))))
  const about = c.repo.description ? wrap(c.repo.description, 40, 3) : []
  const years = [yearOf(c.start), yearOf(c.end)]
  const facts = [
    ...(c.repo.stars !== undefined ? [`${compact(c.repo.stars)} stars`] : []),
    years[0] === years[1] ? `${years[0]}` : `${years[0]}–${years[1]}`,
    `${c.repo.files.toLocaleString("en")} files`,
  ].join("  ·  ")
  const languages = c.repo.languages.slice(0, 3)
  const x = 620
  let y = 150
  const text: string[] = [
    `<text x="${x}" y="108" font-family="Marcellus SC" font-size="20" letter-spacing="3" fill="#dcb662">GUILDHALL · A REPO AS AN ISLAND</text>`,
    `<text x="${x}" y="${y + 18}" font-family="Alegreya Sans" font-size="30" fill="#ab9e85">${escapeXml(owner)}/</text>`,
  ]
  y += 18 + nameSize + 4
  text.push(`<text x="${x}" y="${y}" font-family="Marcellus SC" font-size="${nameSize}" fill="#f3e9d4">${escapeXml(name)}</text>`)
  y += 22
  text.push(`<rect x="${x}" y="${y}" width="72" height="2" fill="url(#rule)"/>`)
  y += 46
  for (const line of about) {
    text.push(`<text x="${x}" y="${y}" font-family="Alegreya Sans" font-size="26" fill="#cdbfa3">${escapeXml(line)}</text>`)
    y += 34
  }
  y += about.length ? 22 : 0
  text.push(`<text x="${x}" y="${y}" font-family="Alegreya Sans" font-weight="500" font-size="26" fill="#f1d590">${escapeXml(facts)}</text>`)
  y += 46
  let lx = x
  for (const [language] of languages) {
    text.push(`<circle cx="${lx + 7}" cy="${y - 8}" r="7" fill="${colourOf(language)}"/>`)
    text.push(`<text x="${lx + 22}" y="${y}" font-family="Alegreya Sans" font-size="22" fill="#cdbfa3">${escapeXml(language)}</text>`)
    lx += 40 + language.length * 10
  }
  text.push(
    `<text x="${x}" y="566" font-family="Alegreya Sans" font-size="22" fill="#ab9e85">guildhall.codestz.dev · watch it grow from its first commit</text>`,
  )

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    "<defs>",
    `<radialGradient id="glow" cx="0.3" cy="0.45" r="0.7"><stop offset="0" stop-color="#3a2c18"/><stop offset="1" stop-color="#15110d"/></radialGradient>`,
    `<radialGradient id="sea" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1f4a52"/><stop offset="0.7" stop-color="#14323a"/><stop offset="1" stop-color="#15110d" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="rule" x1="0" x2="1"><stop offset="0" stop-color="#dcb662"/><stop offset="1" stop-color="#dcb662" stop-opacity="0"/></linearGradient>`,
    "</defs>",
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>`,
    `<rect x="16" y="16" width="${WIDTH - 32}" height="${HEIGHT - 32}" rx="10" fill="none" stroke="#dcb662" stroke-opacity="0.34"/>`,
    islandSvg(c),
    ...text,
    "</svg>",
  ].join("")
}
