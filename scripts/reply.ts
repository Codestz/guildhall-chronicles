/**
 * The comment for a finished build, or a failed one (scripts/lib/replies.ts), to stdout.
 *
 *   bun scripts/reply.ts built <owner/name>
 *   bun scripts/reply.ts failed <run url>
 */
import { builtReply, failedReply } from "./lib/replies.ts"
import { parseRepoName } from "./lib/request.ts"

const [kind, arg = ""] = Bun.argv.slice(2)
if (kind === "built" && parseRepoName(arg)) console.log(builtReply(arg))
else if (kind === "failed") console.log(failedReply(arg))
else {
  console.error("usage: bun scripts/reply.ts built <owner/name> | failed <run url>")
  process.exit(1)
}
