/**
 * Writes the Pages site (site/) from index.json: site/index.html and a preview page for every
 * chronicle (scripts/lib/page.ts). Pages for repos no longer in the index are removed.
 *
 *   bun scripts/site.ts
 *
 * The cards (og/) are copied in by the Pages workflow at deploy time, not kept twice in git.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { type Catalog, pagePath, previewPage, rootPage } from "./lib/page.ts"

const ROOT = join(import.meta.dir, "..")
const SITE = join(ROOT, "site")
const catalog = JSON.parse(await readFile(join(ROOT, "index.json"), "utf8")) as Catalog

await rm(join(SITE, "r"), { recursive: true, force: true })
await mkdir(SITE, { recursive: true })
await writeFile(join(SITE, "index.html"), rootPage())
await writeFile(join(SITE, ".nojekyll"), "")
for (const entry of catalog.repos) {
  const file = join(SITE, pagePath(entry.repo))
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, previewPage(entry))
}
console.log(`${catalog.repos.length} preview pages  →  site/`)
