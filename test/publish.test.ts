import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cardSvg, escapeXml, islandCells, wrap } from "../scripts/lib/card.ts"
import { readChronicle } from "../scripts/lib/chronicle.ts"
import { badgeMarkdown, islandLink, slugOf } from "../scripts/lib/config.ts"
import { type Catalog, type Entry, pagePath, previewPage } from "../scripts/lib/page.ts"

const ROOT = join(import.meta.dir, "..")
const chronicle = (slug: string) => readChronicle(new Uint8Array(readFileSync(join(ROOT, "chronicles", `${slug}.json.gz`))))

describe("the index", () => {
  const index = JSON.parse(readFileSync(join(ROOT, "index.json"), "utf8")) as Catalog

  test("lists every chronicle in chronicles/ once, and nothing else", () => {
    const files = readdirSync(join(ROOT, "chronicles")).filter((name) => name.endsWith(".json.gz"))
    expect(index.repos.map((entry) => `${slugOf(entry.repo)}.json.gz`).sort()).toEqual(files.sort())
  })

  test("every chronicle has its card and its preview page", () => {
    for (const entry of index.repos) {
      expect(readdirSync(join(ROOT, "og"))).toContain(`${slugOf(entry.repo)}.png`)
      expect(readFileSync(join(ROOT, "site", pagePath(entry.repo)), "utf8")).toContain(islandLink(entry.repo))
    }
  })
})

describe("the card", () => {
  test("the same repo grows the same island, sized by its files", () => {
    const react = chronicle("react__react")
    expect(islandCells(react)).toEqual(islandCells(react))
    expect(islandCells(react).length).toBeGreaterThan(islandCells(chronicle("codestz__mintroot")).length)
  })

  test("text from the repo is escaped into the SVG", () => {
    const c = { ...chronicle("codestz__mcpx") }
    c.repo = { ...c.repo, description: `<script>alert("x")</script> & more` }
    const svg = cardSvg(c)
    expect(svg).not.toContain("<script>")
    expect(svg).toContain("&#60;script&#62;")
    expect(escapeXml(`a"b'c`)).toBe("a&#34;b&#39;c")
  })

  test("long descriptions wrap to the lines given, the last one cut", () => {
    const lines = wrap("one two three four five six seven eight nine ten", 10, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1]?.endsWith("…")).toBe(true)
    expect(wrap("short", 10, 2)).toEqual(["short"])
  })
})

describe("the preview page", () => {
  const entry: Entry = {
    repo: "Some/Repo",
    description: `"><script>alert(1)</script>`,
    languages: ["Go"],
    years: [2020, 2024],
    files: 12,
    bytes: 1,
    built: "2026-01-01",
  }

  test("carries the island's card and title, and sends people on to the island", () => {
    const html = previewPage(entry)
    expect(pagePath(entry.repo)).toBe("r/some/repo/index.html")
    expect(html).toContain('<meta property="og:image" content="https://codestz.github.io/guildhall-chronicles/og/some__repo.png">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain('location.replace("https://guildhall.codestz.dev/?repo=Some/Repo&grow")')
    expect(html).not.toContain("http-equiv")
  })

  test("never lets a description out of its attribute", () => {
    const html = previewPage(entry)
    expect(html).not.toContain("<script>alert")
    expect(html.match(/<script>/g)).toHaveLength(1)
  })

  test("the badge links the island", () => {
    expect(badgeMarkdown("a/b")).toEndWith("(https://guildhall.codestz.dev/?repo=a/b&grow)")
  })
})
