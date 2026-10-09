/**
 * A chronicle request: the issue form's answers (.github/ISSUE_TEMPLATE/chronicle.yml), read
 * strictly, and the verdict on it. Pure: request.ts does the GitHub and git calls and hands the
 * facts in. The issue body is untrusted text; nothing in it reaches a shell, only the repo name that
 * passes REPO_NAME does.
 */

/** GitHub's own rules: an owner is 1–39 letters, digits or single inner hyphens; a name 1–100 of [A-Za-z0-9._-]. */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
const NAME = /^[A-Za-z0-9._-]{1,100}$/

/** The form's headings (its fields' labels). */
export const FIELD_REPO = "Repository"
export const FIELD_CONSENT = "Public repo"

/**
 * "owner/name" from what was typed: owner/name, or github.com/owner/name as a link (an optional
 * https://, www., trailing slash or .git). Anything else (spaces, other hosts, deeper paths, queries,
 * "." or ".." names) is undefined.
 */
export function parseRepoName(input: string): string | undefined {
  const text = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.)?github\.com\//i, "")
    .replace(/\/$/, "")
    .replace(/\.git$/i, "")
  const parts = text.split("/")
  if (parts.length !== 2) return undefined
  const [owner = "", name = ""] = parts
  if (!OWNER.test(owner) || !NAME.test(name) || /^\.+$/.test(name)) return undefined
  return `${owner}/${name}`
}

/** An issue form's body as { heading: answer } ("_No response_" is empty). */
export function formAnswers(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  const sections = body.replace(/\r\n/g, "\n").split(/^###\s+/m).slice(1)
  for (const section of sections) {
    const newline = section.indexOf("\n")
    const heading = (newline < 0 ? section : section.slice(0, newline)).trim()
    const answer = newline < 0 ? "" : section.slice(newline + 1).trim()
    out[heading] = answer === "_No response_" ? "" : answer
  }
  return out
}

export type Request = { ok: true; repo: string } | { ok: false; reason: "no-repo" | "bad-repo" | "no-consent"; typed?: string }

/** The request in an issue body: a valid repo name, and the public-repo box ticked. */
export function readRequest(body: string): Request {
  const answers = formAnswers(body)
  const typed = (answers[FIELD_REPO] ?? "").trim()
  if (!typed) return { ok: false, reason: "no-repo" }
  const repo = parseRepoName(typed)
  if (!repo) return { ok: false, reason: "bad-repo", typed: typed.slice(0, 120) }
  if (!/^- \[[xX]\]/m.test(answers[FIELD_CONSENT] ?? "")) return { ok: false, reason: "no-consent" }
  return { ok: true, repo }
}

/** What GitHub says about the repo (repos/{owner}/{name}), as far as the guards need. */
export interface RepoFacts {
  /** As GitHub spells it now (a renamed repo answers with its new name). */
  fullName: string
  private: boolean
  /** Size in KB, as GitHub reports it. */
  sizeKB: number
  /** The default branch has commits (an empty repo has no default branch to read). */
  empty: boolean
}

export interface Limits {
  /** Largest repo built, MB. */
  maxSizeMB: number
  /** Builds a day for requests from outside the repo's maintainers. */
  dailyCap: number
  /** Requests from outside need the `approved` label before they build. */
  requireApproval: boolean
}

export interface Facts {
  request: Request
  /** Undefined when GitHub has no public repo by that name. */
  repo?: RepoFacts
  /** Its chronicle is already in chronicles/. */
  built: boolean
  /** Requests built today (UTC). */
  builtToday: number
  /** The issue's author can write to this repo (OWNER, MEMBER or COLLABORATOR). */
  trusted: boolean
  /** The issue carries the `approved` label. */
  approved: boolean
}

export type Verdict =
  | { kind: "build"; repo: string }
  /** Already chronicled: point at it and close. */
  | { kind: "done"; repo: string }
  /** Can't or won't be built: say why and close. */
  | { kind: "refuse"; why: string; repo?: string }
  /** Not yet: say why, leave it open with a label. */
  | { kind: "wait"; why: "approval" | "daily-cap"; repo: string }

/** The verdict, guards in order: a readable request, a public repo, not built yet, not too big, approval, the day's cap. */
export function judge(facts: Facts, limits: Limits): Verdict {
  const { request } = facts
  if (!request.ok) {
    const why =
      request.reason === "no-repo"
        ? "The form's repository field is empty."
        : request.reason === "bad-repo"
          ? `\`${request.typed?.replace(/`/g, "'")}\` isn't a GitHub repo name. Use owner/name, or a github.com/owner/name link.`
          : "The public-repo box isn't ticked: chronicles are only built for public repos whose owners are happy to see them."
    return { kind: "refuse", why }
  }
  if (!facts.repo || facts.repo.private)
    return { kind: "refuse", why: `GitHub has no public repo called ${request.repo}. Only public repos can be chronicled.` }
  const repo = facts.repo.fullName
  if (facts.built) return { kind: "done", repo }
  if (facts.repo.empty) return { kind: "refuse", why: `${repo} has no commits yet: there is no history to read.`, repo }
  const mb = facts.repo.sizeKB / 1024
  if (mb > limits.maxSizeMB)
    return {
      kind: "refuse",
      why: `${repo} is about ${Math.round(mb).toLocaleString("en")} MB, over this repo's ${limits.maxSizeMB.toLocaleString("en")} MB limit for a build.`,
      repo,
    }
  if (facts.trusted) return { kind: "build", repo }
  if (limits.requireApproval && !facts.approved) return { kind: "wait", why: "approval", repo }
  if (facts.builtToday >= limits.dailyCap) return { kind: "wait", why: "daily-cap", repo }
  return { kind: "build", repo }
}

/** A positive whole number from a setting, else the fallback. */
export function setting(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}
