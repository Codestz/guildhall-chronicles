import { describe, expect, test } from "bun:test"
import { type Facts, formAnswers, judge, type Limits, parseRepoName, readRequest } from "../scripts/lib/request.ts"

/** An issue body as GitHub writes the form's answers. */
const body = (repo: string, ticked = true) =>
  `### Repository\n\n${repo}\n\n### Public repo\n\n- [${ticked ? "X" : " "}] This repo is public, and I'm happy for its aggregate history to be published here.\n`

describe("repo names", () => {
  test("owner/name and github.com links, trimmed", () => {
    for (const typed of [
      "facebook/react",
      "  facebook/react \n",
      "github.com/facebook/react",
      "https://github.com/facebook/react",
      "https://www.github.com/facebook/react/",
      "https://github.com/facebook/react.git",
    ])
      expect(parseRepoName(typed)).toBe("facebook/react")
    expect(parseRepoName("vercel/next.js")).toBe("vercel/next.js")
    expect(parseRepoName("a-b/c_d-e.f")).toBe("a-b/c_d-e.f")
  })

  test("anything else is refused: other hosts, deeper paths, queries, shell text, bad owners", () => {
    for (const typed of [
      "",
      "react",
      "facebook/react/tree/main",
      "gitlab.com/facebook/react",
      "https://github.com/facebook/react?tab=readme",
      "facebook/react; rm -rf /",
      "facebook/$(whoami)",
      "face book/react",
      "-facebook/react",
      "face--book/react",
      "facebook/..",
      "facebook/.",
      `${"a".repeat(40)}/react`,
      `facebook/${"a".repeat(101)}`,
      "facebook/react\nother/repo",
    ])
      expect(parseRepoName(typed)).toBeUndefined()
  })
})

describe("the issue form", () => {
  test("answers by heading, '_No response_' as empty", () => {
    expect(formAnswers("### Repository\n\n_No response_\n\n### Public repo\n\n- [X] ok")).toEqual({
      Repository: "",
      "Public repo": "- [X] ok",
    })
  })

  test("a request needs a valid repo and the public box ticked", () => {
    expect(readRequest(body("https://github.com/facebook/react"))).toEqual({ ok: true, repo: "facebook/react" })
    expect(readRequest(body("facebook/react", false))).toEqual({ ok: false, reason: "no-consent" })
    expect(readRequest(body("not a repo"))).toEqual({ ok: false, reason: "bad-repo", typed: "not a repo" })
    expect(readRequest("Please chronicle react")).toEqual({ ok: false, reason: "no-repo" })
    expect(readRequest(body("facebook/react").replace(/\n/g, "\r\n"))).toEqual({ ok: true, repo: "facebook/react" })
  })
})

describe("the verdict", () => {
  const limits: Limits = { maxSizeMB: 2048, dailyCap: 10, requireApproval: false }
  const facts = (over: Partial<Facts> = {}): Facts => ({
    request: { ok: true, repo: "facebook/react" },
    repo: { fullName: "facebook/react", private: false, sizeKB: 400_000, empty: false },
    built: false,
    builtToday: 0,
    trusted: false,
    approved: false,
    ...over,
  })

  test("a fair request builds, under GitHub's spelling of the name", () => {
    const renamed = facts({ repo: { fullName: "react/react", private: false, sizeKB: 1, empty: false } })
    expect(judge(renamed, limits)).toEqual({ kind: "build", repo: "react/react" })
  })

  test("already chronicled: done, with the repo to link", () => {
    expect(judge(facts({ built: true }), limits)).toEqual({ kind: "done", repo: "facebook/react" })
  })

  test("refused: unreadable, private or missing, empty, too big", () => {
    expect(judge(facts({ request: { ok: false, reason: "no-consent" } }), limits).kind).toBe("refuse")
    expect(judge(facts({ repo: undefined }), limits).kind).toBe("refuse")
    expect(judge(facts({ repo: { fullName: "a/b", private: true, sizeKB: 1, empty: false } }), limits).kind).toBe(
      "refuse",
    )
    expect(judge(facts({ repo: { fullName: "a/b", private: false, sizeKB: 0, empty: true } }), limits).kind).toBe(
      "refuse",
    )
    const atCap = { fullName: "a/b", private: false, sizeKB: 2048 * 1024, empty: false }
    expect(judge(facts({ repo: atCap }), limits).kind).toBe("build")
    expect(judge(facts({ repo: { ...atCap, sizeKB: atCap.sizeKB + 1024 } }), limits).kind).toBe("refuse")
  })

  test("a refusal quotes what was typed without letting it break out of its code span", () => {
    const verdict = judge(facts({ request: { ok: false, reason: "bad-repo", typed: "a`b" } }), limits)
    expect(verdict.kind === "refuse" && verdict.why).toContain("`a'b`")
  })

  test("outsiders wait for approval when it's required, and for tomorrow past the day's cap", () => {
    const strict = { ...limits, requireApproval: true }
    expect(judge(facts(), strict)).toEqual({ kind: "wait", why: "approval", repo: "facebook/react" })
    expect(judge(facts({ approved: true }), strict).kind).toBe("build")
    expect(judge(facts({ builtToday: 9 }), limits).kind).toBe("build")
    expect(judge(facts({ builtToday: 10 }), limits)).toEqual({ kind: "wait", why: "daily-cap", repo: "facebook/react" })
  })

  test("maintainers skip approval and the cap, but not the size limit", () => {
    const strict = { ...limits, requireApproval: true }
    expect(judge(facts({ trusted: true, builtToday: 99 }), strict).kind).toBe("build")
    const huge = { fullName: "a/b", private: false, sizeKB: 5e6, empty: false }
    expect(judge(facts({ trusted: true, repo: huge }), strict).kind).toBe("refuse")
  })
})
