# Guildhall chronicles

Deep chronicles of public GitHub repos for [Guildhall](https://guildhall.codestz.dev), the browser
world that grows a repo into a voxel island. A chronicle is a repo's whole history, read once and
stored small (a few KB to a few dozen KB gzipped): its folders over time, its releases, its
contributors week by week. With one, an island grows from the first commit (`?repo=owner/name&grow`).
Without one, the hall sketches the history from about 20 live API calls.

This repo is the backend, and it is only GitHub:

| Piece | What does it |
| --- | --- |
| A request | An issue from the **Chronicle a repo** form |
| The builder | A GitHub Action (`.github/workflows/build.yml`) running `builder/chronicle.js` |
| Storage | This repo's `main`: `chronicles/`, `og/`, `index.json`, `site/` |
| Delivery | [jsDelivr](https://www.jsdelivr.com/) mirroring `main`: `https://cdn.jsdelivr.net/gh/Codestz/guildhall-chronicles@main/…` |
| Previews | `site/` on GitHub Pages: `r/<owner>/<name>/` pages carrying each island's card for link unfurls |

The hall has no server and holds no token. It reads `index.json` and `chronicles/*.json.gz` from the
CDN, falling back to the few chronicles it ships with, then to the live sketch.

## Ask for a chronicle

1. [Open a request](https://github.com/Codestz/guildhall-chronicles/issues/new?template=chronicle.yml)
   (the hall's **Deepen this island** button opens it with the repo filled in).
2. Give the repo as `owner/name` or its github.com link, and tick the public-repo box.
3. The Action checks it, builds it (minutes for most repos, longer for the biggest), commits it, and
   answers on the issue with the island's link and a README badge, then closes it.

What can stop a request:

- **Not readable**: the name must be `owner/name` or a `github.com/owner/name` link, nothing else.
- **Not public**, or not on GitHub, or no commits yet.
- **Already chronicled**: you get its link. Popular chronicles are refreshed weekly.
- **Too big**: over 2 GB on GitHub (`CHRONICLE_MAX_SIZE_MB`).
- **Waiting**: requests from outside the maintainers can be held for an `approved` label
  (`CHRONICLE_REQUIRE_APPROVAL`), and builds are capped per day (`CHRONICLE_DAILY_CAP`, default 10).
  Held issues stay open with the `queued` label.

## Privacy

Only **public** repos, and only **aggregate history**. A chronicle holds:

- counts: files, bytes and commits per top-level folder (or workspace package) over time, weekly
  commit, PR and issue counts, lines added and removed per week;
- names: the repo's folder names, release tags and titles, and contributors' display names and
  GitHub logins (the same names `git log` shows anyone who clones the repo);
- the repo's description, stars, forks, languages and creation date.

It holds **no code, no file contents, no file paths below the top-level folders, and no email
addresses**. The builder clones without file contents (`--filter=blob:none`) and fails rather than
download one. Everything in it is already public on GitHub; it is just counted.

To have a chronicle removed, open an issue (any kind) and say which one. Owners of the repo get it
removed without question.

## Layout

```
.github/ISSUE_TEMPLATE/chronicle.yml   the request form (field ids: repo, public)
.github/workflows/build.yml            a request → guards → build → publish → answer
.github/workflows/refresh.yml          weekly: rebuild the top N by stars
.github/workflows/pages.yml            site/ + og/ → GitHub Pages (off until enabled)
builder/chronicle.js                   the deep builder, vendored from Guildhall (see below)
chronicles/<owner>__<name>.json.gz     the chronicles (lower case)
og/<owner>__<name>.png                 their 1200×630 preview cards
index.json                             the catalog: name, stars, languages, years, size, built date
site/                                  the Pages site: index.html, r/<owner>/<name>/index.html
scripts/request.ts                     reads an issue and decides (pure rules in scripts/lib/request.ts)
scripts/og.ts                          a chronicle's card (scripts/lib/card.ts), rendered with resvg
scripts/site.ts                        site/ from index.json (scripts/lib/page.ts)
scripts/publish.sh                     commit a build onto the latest main, retrying a lost race
scripts/refresh.ts, scripts/reply.ts   the refresh list; the issue comments
assets/fonts/                          Marcellus SC and Alegreya Sans (SIL OFL), for the cards
```

## Run it by hand

Needs [Bun](https://bun.sh) ≥ 1.3.5 and git.

```sh
bun install
GITHUB_TOKEN=$(gh auth token) bun builder/chronicle.js deep facebook/react --out chronicles/react__react.json.gz
bun scripts/og.ts chronicles/react__react.json.gz og/react__react.png
bun builder/chronicle.js index chronicles --out index.json
bun scripts/site.ts
bun test
```

A token is optional but strongly advised: without one GitHub allows 60 calls an hour, and a big repo's
PR and issue counts alone take dozens.

## The builder

`builder/chronicle.js` is Guildhall's `scripts/chronicle.ts` (and the chronicle format it writes)
bundled into one file, with no dependencies. It is vendored rather than fetched at run time so a
build never depends on another repo being reachable, and so every change to it is a reviewable diff
here. Its first lines name the Guildhall commit it came from. To update it, in a Guildhall checkout:

```sh
bun scripts/chronicle-build.ts --out ../guildhall-chronicles/builder/chronicle.js
```

then commit it here. Rebuild it whenever the chronicle format or the deep builder changes in
Guildhall (`packages/hall/src/world/chronicle/{deep,format,catalog}.ts`, `scripts/chronicle.ts`).

## Settings

Repository variables (Settings → Secrets and variables → Actions → Variables), all optional:

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHRONICLE_MAX_SIZE_MB` | `2048` | Largest repo built, by GitHub's reported size |
| `CHRONICLE_DAILY_CAP` | `10` | Outside requests built per UTC day |
| `CHRONICLE_REQUIRE_APPROVAL` | `false` | `true`: outside requests wait for the `approved` label |
| `CHRONICLE_REFRESH_TOP` | `12` | How many chronicles the weekly refresh rebuilds |
| `PAGES_ENABLED` | unset | `true` once Pages is on: deploys `site/` after each build |

No secrets: the workflows use the job's own `GITHUB_TOKEN`, scoped per job (contents and issues for
builds, contents for the refresh, Pages for the deploy).
