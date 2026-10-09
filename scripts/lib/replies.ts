import { badgeMarkdown, islandLink, previewLink } from "./config.ts"
import type { Verdict } from "./request.ts"

/** The bot's comments on a request issue, in Markdown. */

export function builtReply(repo: string): string {
  return [
    `**${repo}** is chronicled. Its island, growing from the first commit:`,
    "",
    `**${islandLink(repo)}**`,
    "",
    "It can take a few minutes to reach the CDN. To show it off in a README:",
    "",
    "```markdown",
    badgeMarkdown(repo),
    "```",
    "",
    `A link that unfurls with the island's card (once this repo's Pages site is up): ${previewLink(repo)}`,
    "",
    "The chronicle holds counts, folder names, release tags and contributor names, never code. It is refreshed weekly while it stays among the most-starred here.",
  ].join("\n")
}

export function verdictReply(verdict: Exclude<Verdict, { kind: "build" }>, dailyCap: number): string {
  switch (verdict.kind) {
    case "done":
      return `**${verdict.repo}** is already chronicled: ${islandLink(verdict.repo)}\n\nClosing this one. Popular chronicles are refreshed weekly.`
    case "refuse":
      return `This one can't be built: ${verdict.why}\n\nClosing it. Fix the request and open a new issue if you like.`
    case "wait":
      return verdict.why === "approval"
        ? `Thanks! Requests here are built once a maintainer approves them (the \`approved\` label). **${verdict.repo}** is in the queue.`
        : `Today's builds are used up (${dailyCap} a day, to keep this free for everyone). **${verdict.repo}** is queued: a maintainer will run it, or close and reopen this issue tomorrow.`
  }
}

export function failedReply(runUrl: string): string {
  return `The build didn't finish ([the run's log](${runUrl})). A maintainer will take a look; nothing was published.`
}
