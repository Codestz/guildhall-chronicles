/**
 * After `builder/chronicle.js index` has written index.json: stamps it with the builder that made
 * the chronicles (`builder`, read from the bundle's banner) and rewrites the README's catalog table
 * (between the catalog markers) from it, so one publish commit carries both.
 *
 *   bun scripts/catalog.ts
 *
 * `builder` is an extra field; readers of index.json (Guildhall's parseCatalog) keep the fields they
 * know and ignore the rest, so `v` stays 1.
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { builderOf, catalogTable, spliceCatalog } from "./lib/catalog.ts"
import type { Catalog } from "./lib/page.ts"

const ROOT = join(import.meta.dir, "..")
const indexFile = join(ROOT, "index.json")
const readmeFile = join(ROOT, "README.md")

const catalog = JSON.parse(await readFile(indexFile, "utf8")) as Catalog
const builder = builderOf(await readFile(join(ROOT, "builder/chronicle.js"), "utf8"))
if (builder) catalog.builder = builder
else console.warn("builder/chronicle.js has no Source/Built banner; index.json gets no builder field")
await writeFile(indexFile, `${JSON.stringify(catalog, null, 1)}\n`)

const readme = await readFile(readmeFile, "utf8")
await writeFile(readmeFile, spliceCatalog(readme, catalogTable(catalog.repos)))
console.log(`${catalog.repos.length} chronicles  →  index.json (builder ${builder?.commit.slice(0, 7) ?? "unknown"}), README.md`)
