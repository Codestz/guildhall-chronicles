/**
 * The chronicles the weekly refresh rebuilds: the top N of index.json by stars, one "owner/name" a
 * line (the index is already sorted, most stars first).
 *
 *   bun scripts/refresh.ts [N=12]
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Catalog } from "./lib/page.ts"
import { setting } from "./lib/request.ts"

const top = setting(Bun.argv[2], 12)
const catalog = JSON.parse(await readFile(join(import.meta.dir, "../index.json"), "utf8")) as Catalog
for (const entry of catalog.repos.slice(0, top)) console.log(entry.repo)
