/**
 * Reads a chronicle request issue and decides what to do with it (scripts/lib/request.ts' judge),
 * for .github/workflows/build.yml. The issue is fetched from the API by number (never passed through
 * the workflow's expressions), so the same path serves the issue events and a maintainer's manual run.
 *
 *   ISSUE=12 bun scripts/request.ts
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT, RUNNER_TEMP; the repo variables
 * CHRONICLE_MAX_SIZE_MB (2048), CHRONICLE_DAILY_CAP (10), CHRONICLE_REQUIRE_APPROVAL ("true" or not);
 * MAINTAINER_RUN ("true" for a manual run: trusted, like a maintainer's own request).
 * Writes to GITHUB_OUTPUT: verdict (build | done | refuse | wait | skip), repo, slug; and for a
 * verdict other than build and skip, the comment to post in $RUNNER_TEMP/reply.md.
 */
import { appendFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { slugOf } from "./lib/config.ts"
import { verdictReply } from "./lib/replies.ts"
import { type Facts, judge, type Limits, parseRepoName, readRequest, type RepoFacts, setting } from "./lib/request.ts"

const env = process.env
const ROOT = join(import.meta.dir, "..")
const issueNumber = setting(env.ISSUE, 0)
if (!issueNumber) throw new Error("ISSUE must be an issue number")

const limits: Limits = {
  maxSizeMB: setting(env.CHRONICLE_MAX_SIZE_MB, 2048),
  dailyCap: setting(env.CHRONICLE_DAILY_CAP, 10),
  requireApproval: env.CHRONICLE_REQUIRE_APPROVAL === "true",
}

async function api(path: string): Promise<unknown | undefined> {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    },
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`)
  return response.json()
}

async function output(values: Record<string, string>): Promise<void> {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`)
  console.log(lines.join("\n"))
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `${lines.join("\n")}\n`)
}

interface IssueJson {
  state: string
  body?: string | null
  author_association: string
  labels: { name: string }[]
  pull_request?: unknown
}
const issue = (await api(`repos/${env.GITHUB_REPOSITORY}/issues/${issueNumber}`)) as IssueJson | undefined
const labels = new Set(issue?.labels.map((label) => label.name))
if (!issue || issue.pull_request || issue.state !== "open" || !labels.has("chronicle")) {
  await output({ verdict: "skip", repo: "", slug: "" })
  process.exit(0)
}

const request = readRequest(issue.body ?? "")
let repo: RepoFacts | undefined
if (request.ok) {
  const meta = (await api(`repos/${request.repo}`)) as
    | { full_name: string; private: boolean; visibility?: string; size: number }
    | undefined
  const fullName = meta && parseRepoName(meta.full_name)
  if (meta && fullName)
    repo = {
      fullName,
      private: meta.private || (meta.visibility !== undefined && meta.visibility !== "public"),
      sizeKB: meta.size,
      empty: meta.size === 0,
    }
}

const midnight = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`
const todays = await Bun.$`git -C ${ROOT} log --since=${midnight} --format=%s`.text()
const facts: Facts = {
  request,
  ...(repo ? { repo } : {}),
  built: repo ? await exists(join(ROOT, "chronicles", `${slugOf(repo.fullName)}.json.gz`)) : false,
  builtToday: todays.split("\n").filter((line) => line.startsWith("chronicle: build ")).length,
  // A manual run (workflow_dispatch) can only be started by someone with write access.
  trusted: env.MAINTAINER_RUN === "true" || ["OWNER", "MEMBER", "COLLABORATOR"].includes(issue.author_association),
  approved: labels.has("approved"),
}

const verdict = judge(facts, limits)
const named = verdict.repo
await output({ verdict: verdict.kind, repo: named ?? "", slug: named ? slugOf(named) : "" })
if (verdict.kind !== "build")
  await writeFile(join(env.RUNNER_TEMP ?? ROOT, "reply.md"), verdictReply(verdict, limits.dailyCap))

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}
