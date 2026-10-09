/**
 * A chronicle's preview card as PNG (scripts/lib/card.ts), 1200×630.
 *
 *   bun scripts/og.ts <chronicles/owner__name.json.gz> <og/owner__name.png>
 *
 * Fonts are the hall's (Marcellus SC, Alegreya Sans; SIL OFL, in assets/fonts), loaded from here so
 * a card looks the same on any runner.
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { cardSvg } from "./lib/card.ts"
import { readChronicle } from "./lib/chronicle.ts"

const [input, output] = Bun.argv.slice(2)
if (!input || !output) {
  console.error("usage: bun scripts/og.ts <chronicle.json.gz> <card.png>")
  process.exit(1)
}
const fonts = join(import.meta.dir, "../assets/fonts")
const chronicle = readChronicle(new Uint8Array(await readFile(input)))
const png = new Resvg(cardSvg(chronicle), {
  font: {
    fontFiles: ["MarcellusSC-Regular.ttf", "AlegreyaSans-Regular.ttf", "AlegreyaSans-Medium.ttf"].map((f) => join(fonts, f)),
    loadSystemFonts: false,
    defaultFontFamily: "Alegreya Sans",
  },
})
  .render()
  .asPng()
await writeFile(output, png)
console.log(`${chronicle.repo.name}  →  ${output} (${(png.length / 1024).toFixed(0)} KB)`)
