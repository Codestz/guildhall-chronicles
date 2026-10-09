/**
 * Where things live. One place to change when the repo, the hall or the Pages site moves.
 */

/** This repo, as GitHub spells it. */
export const REPO = "Codestz/guildhall-chronicles"
/** The hall, which reads the chronicles and draws the islands. */
export const HALL = "https://guildhall.codestz.dev"
/** jsDelivr's mirror of this repo's main branch: what the hall fetches. */
export const CDN = `https://cdn.jsdelivr.net/gh/${REPO}@main`
/** This repo's GitHub Pages site (site/, once Pages is enabled): the per-repo preview pages. */
export const PAGES = "https://codestz.github.io/guildhall-chronicles"

/** "owner/name" → the file stem every artefact uses: "owner__name", lower case. */
export function slugOf(repo: string): string {
  return repo.toLowerCase().replace("/", "__")
}

/** The island in the hall, growing through its history. */
export function islandLink(repo: string): string {
  return `${HALL}/?repo=${repo}&grow`
}

/** The preview page (site/r/owner/name/), whose link unfurls with the island's card. */
export function previewLink(repo: string): string {
  return `${PAGES}/r/${repo.toLowerCase()}/`
}

/** A README badge linking to the island. */
export function badgeMarkdown(repo: string): string {
  const image = "https://img.shields.io/badge/Guildhall-see_it_as_an_island-dcb662?labelColor=15110d"
  return `[![See ${repo} as an island in Guildhall](${image})](${islandLink(repo)})`
}
