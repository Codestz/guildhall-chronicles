// @bun
// Guildhall's deep chronicle builder, bundled by scripts/chronicle-build.ts. Do not edit: rebuild it.
// Source: https://github.com/Codestz/guildhall/blob/33b3002c44f95698e12bbcc75728adf92d9864f0/scripts/chronicle.ts (plus uncommitted changes)
// Built: 2026-10-09T02:06:40.803Z
// scripts/chronicle.ts
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// packages/hall/src/world/chronicle/format.ts
var CHRONICLE_VERSION = 1;
var MAX_CONTRIBUTORS = 300;
var MAX_MILESTONES = 48;

class ChronicleError extends Error {
  name = "ChronicleError";
}
var DAY_MS = 86400000;
function dayOf(when) {
  const ms = typeof when === "string" ? Date.parse(when) : when;
  return Math.floor(ms / DAY_MS);
}
function isoOf(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
function activityChar(commits) {
  return Math.max(0, Math.min(35, Math.round(commits))).toString(36);
}
function encodeChronicle(c) {
  return JSON.stringify(c);
}
function decodeChronicle(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ChronicleError("not a chronicle: not JSON");
  }
  const c = value;
  if (!c || typeof c !== "object")
    throw new ChronicleError("not a chronicle");
  if (c.v !== CHRONICLE_VERSION)
    throw new ChronicleError(`unsupported chronicle version ${String(c.v)}`);
  if (c.depth !== "deep" && c.depth !== "quick" || typeof c.start !== "number" || typeof c.end !== "number" || !c.repo || !c.snapshots || !Array.isArray(c.snapshots.day) || !Array.isArray(c.units) || !Array.isArray(c.contributors) || !Array.isArray(c.releases) || !Array.isArray(c.milestones) || !c.weekly)
    throw new ChronicleError("not a chronicle: missing sections");
  const samples = c.snapshots.day.length;
  for (const unit of c.units)
    if (unit.files.length !== samples || unit.bytes.length !== samples)
      throw new ChronicleError(`not a chronicle: unit ${unit.name} has the wrong number of samples`);
  return c;
}
async function readChronicle(bytes) {
  if (bytes[0] === 31 && bytes[1] === 139) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return decodeChronicle(await new Response(stream).text());
  }
  return decodeChronicle(new TextDecoder().decode(bytes));
}

// packages/hall/src/world/chronicle/catalog.ts
var CHRONICLES_REPO = "Codestz/guildhall-chronicles";
var CHRONICLES_CDN = `https://cdn.jsdelivr.net/gh/${CHRONICLES_REPO}@main/`;
var CATALOG_VERSION = 1;
var DESCRIPTION_MAX = 200;
function catalogEntry(c) {
  const description = c.repo.description?.trim();
  return {
    repo: c.repo.name,
    ...description ? { description: clip(description) } : {},
    ...c.repo.stars !== undefined ? { stars: c.repo.stars } : {},
    languages: c.repo.languages.slice(0, 3).map(([name]) => name),
    years: [yearOf(c.start), yearOf(c.end)],
    files: c.repo.files,
    bytes: c.repo.bytes,
    built: c.generatedAt.slice(0, 10)
  };
}
function buildCatalog(chronicles, updated) {
  const byRepo = new Map;
  for (const c of chronicles) {
    const key = c.repo.name.toLowerCase();
    const kept = byRepo.get(key);
    if (!kept || kept.generatedAt < c.generatedAt)
      byRepo.set(key, c);
  }
  const repos = [...byRepo.values()].map(catalogEntry).sort(byStars);
  return { v: CATALOG_VERSION, updated: updated.slice(0, 10), repos };
}
function byStars(a, b) {
  return (b.stars ?? 0) - (a.stars ?? 0) || a.repo.localeCompare(b.repo);
}
function yearOf(day) {
  return Number(isoOf(day).slice(0, 4));
}
function clip(text) {
  return text.length <= DESCRIPTION_MAX ? text : `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}\u2026`;
}
// packages/hall/src/world/lands.ts
var HEX_SCALE = 5;
var SIZE = HEX_SCALE * 2 / Math.sqrt(3);
function hexToWorld(q, r) {
  return [1.5 * SIZE * q, Math.sqrt(3) * SIZE * (r + q / 2)];
}
var MAP = `
  ~   ~   ~   ~   ~   ~   ~   ~   ~
~   ~   ~   ~   ~   ~   ~   ~   ~   ~
  ~   ~   ~   m   M   m   ~   ~   ~
~   ~   f   m   M   M   m   m   ~   ~
  ~   F   m   M   M   M   m   m   ~
~   F   f   m   m   M   s   m   m   ~
  ~   F   f   o   H   s   s   m   ~
~   F   v   r   .   h   =   H   m   ~
  F   F   s   f   .   f   .   H   ~
~   F   =   r   .   f   =   .   .   ~
  F   F   r   .   f   .   =   w   .
~   F   =   .   .   .   .   v   w   ~
  F   F   r   v   v   v   =   w   d
~   F   =   v   v   v   v   =   w   ~
  F   F   r   K   K   K   v   w   w
~   F   =   v   K   K   v   =   d   ~
  F   F   r   K   K   K   v   d   w
~   F   =   v   K   K   v   =   w   ~
  F   =   r   K   =   K   v   s   d
~   F   =   v   V   V   v   =   s   ~
  f   v   #   =   =   =   =   s   w
~   f   f   =   =   =   =   .   d   ~
  ~   f   r   v   =   v   s   w   .
~   .   .   =   v   v   =   s   .   ~
  ~   h   r   .   =   .   =   .   ~
~   .   v   =   f   .   .   s   h   ~
  ~   .   r   .   =   f   .   h   ~
~   .   r   .   .   .   .   .   .   ~
  ~   .   .   .   =   .   .   .   ~
~   ~   ~   .   .   .   .   ~   ~   ~
  ~   ~   ~   .   ~   .   ~   ~   ~
~   ~   ~   ~   ~   ~   ~   ~   ~   ~
  ~   ~   ~   ~   ~   ~   ~   ~   ~
`;
var TOP = -16;
var LEFT = -9;
var key = ([q, line]) => `${q},${line}`;
function cellToWorld([q, line]) {
  return hexToWorld(q, (line - q) / 2);
}
var DIRS = [
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
  [0, -2],
  [1, -1]
];
var step = ([q, line], dir) => {
  const d = DIRS[(dir % 6 + 6) % 6] ?? [0, 0];
  return [q + d[0], line + d[1]];
};
function direction(from, to) {
  const dir = DIRS.findIndex((d) => from[0] + d[0] === to[0] && from[1] + d[1] === to[1]);
  if (dir < 0)
    throw new Error(`hexes ${key(from)} and ${key(to)} are not neighbours`);
  return dir;
}
var GRID = new Map;
MAP.split(`
`).slice(1, -1).forEach((text, i) => {
  for (let at = 0;at < text.length; at++) {
    const char = text[at];
    if (!char || char === " ")
      continue;
    const cell = [at / 2 + LEFT, i + TOP];
    if (at % 2 !== 0 || (cell[0] - cell[1]) % 2 !== 0)
      throw new Error(`MAP: '${char}' off the grid at ${key(cell)}`);
    GRID.set(key(cell), char);
  }
});
var at = (cell) => GRID.get(key(cell)) ?? "~";
var PLACES = {
  OUT: [0, 4],
  DOCKS: [0, 12],
  BRIDGE: [-4, 4],
  FOREST: [-6, 2],
  TOWER: [-5, -7],
  RIVER: [-3, 9],
  YARD: [5, 3],
  PROVING: [4, 8],
  QUARRY: [3, -9]
};
var ROADS = [
  [PLACES.OUT, [0, 6], [0, 8], [0, 10], PLACES.DOCKS],
  [PLACES.OUT, [-1, 5], [-2, 4], [-3, 5], PLACES.BRIDGE, [-5, 3], PLACES.FOREST],
  [[-5, 3], [-5, 1], [-5, -1], [-5, -3], [-5, -5], PLACES.TOWER],
  [[-3, 5], [-3, 7], PLACES.RIVER],
  [PLACES.OUT, [1, 5], [2, 4], [3, 5], [4, 4], PLACES.YARD],
  [PLACES.YARD, [5, 1], [5, -1], [5, -3], [4, -4], [4, -6], [3, -7], PLACES.QUARRY],
  [[3, 5], [3, 7], PLACES.PROVING]
];
var STUBS = [
  [[0, 2], [1]],
  [PLACES.OUT, [4]],
  [PLACES.DOCKS, [1]]
];
var RIVER = [
  [-2, -10],
  [-3, -9],
  [-3, -7],
  [-4, -6],
  [-4, -4],
  [-4, -2],
  [-4, 0],
  [-4, 2],
  PLACES.BRIDGE,
  [-4, 6],
  [-4, 8],
  [-4, 10],
  [-5, 11],
  [-5, 13]
];
var nodeName = (cell) => Object.entries(PLACES).find(([, place]) => key(place) === key(cell))?.[0] ?? `R${cell[0]}_${cell[1]}`;
var ROAD_NODES = Object.fromEntries(ROADS.flat().map((cell) => [nodeName(cell), cellToWorld(cell)]));
var ROAD_EDGES = ROADS.flatMap((road) => road.slice(1).map((cell, i) => [nodeName(road[i] ?? cell), nodeName(cell)]));
function links(paths) {
  const open = new Map;
  const add = (cell, dir) => {
    const set = open.get(key(cell)) ?? new Set;
    set.add(dir);
    open.set(key(cell), set);
  };
  for (const path of paths) {
    for (let i = 1;i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (!a || !b)
        continue;
      add(a, direction(a, b));
      add(b, direction(b, a));
    }
  }
  return open;
}
var ROAD_LINKS = links(ROADS);
for (const [cell, dirs] of STUBS)
  for (const dir of dirs)
    ROAD_LINKS.set(key(cell), new Set([...ROAD_LINKS.get(key(cell)) ?? [], dir]));
var RIVER_LINKS = links([RIVER]);
function toward(x, z, tx, tz) {
  return [x, z, Math.atan2(tx - x, tz - z)];
}
function stand(work, from, distance) {
  const length = Math.hypot(from[0] - work[0], from[1] - work[1]) || 1;
  const x = work[0] + (from[0] - work[0]) / length * distance;
  const z = work[1] + (from[1] - work[1]) / length * distance;
  return toward(round(x), round(z), work[0], work[1]);
}
var round = (value) => Math.round(value * 100) / 100;
var W = cellToWorld;
var WORK = {
  forest: [W([-7, 1]), W([-7, 3]), W([-6, 0])],
  quarry: [
    [17.5, -49],
    [34, -49],
    [26, -52]
  ],
  river: [
    [-33.5, 40],
    [-33.5, 50],
    [-33.5, 45]
  ],
  targets: [
    [40.5, 34],
    [43.5, 38.5],
    [38, 31]
  ]
};
var YARD_AT = W([6, 2]);
var TOWER_AT = W([-5, -9]);
var SITES = {
  yard: {
    id: "yard",
    label: "Construction yard",
    at: YARD_AT,
    posts: [
      stand(YARD_AT, [44, 15], 7.5),
      stand(YARD_AT, [50, 20], 7.5),
      stand(YARD_AT, [43, 7], 7.5),
      stand(YARD_AT, [56, 19], 7.5)
    ]
  },
  forest: {
    id: "forest",
    label: "Forest edge",
    at: [-56, 7],
    landmark: "building_lumbermill_blue",
    posts: WORK.forest.map((tree) => stand(tree, W(PLACES.FOREST), 5))
  },
  river: {
    id: "river",
    label: "River bend",
    at: [-31, 45],
    landmark: "building_watermill_blue",
    posts: WORK.river.map((water) => stand(water, [-20, water[1]], 3.2))
  },
  proving: {
    id: "proving",
    label: "Proving grounds",
    at: [40, 36],
    landmark: "building_archeryrange_blue",
    posts: WORK.targets.map((target) => stand(target, W(PLACES.PROVING), 2.6))
  },
  quarry: {
    id: "quarry",
    label: "Quarry",
    at: [26, -50],
    landmark: "building_mine_blue",
    posts: WORK.quarry.map((rock) => stand(rock, W(PLACES.QUARRY), 3.5))
  },
  tower: {
    id: "tower",
    label: "Wizard tower",
    at: TOWER_AT,
    landmark: "building_tower_A_blue",
    posts: [toward(-40, -39.5, TOWER_AT[0], TOWER_AT[1]), toward(-46.6, -39.5, TOWER_AT[0], TOWER_AT[1])]
  }
};
var SITE_OF = Object.fromEntries(Object.values(SITES).flatMap((site) => site.landmark ? [[site.landmark, site.id]] : []));
var facing = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
function put(piece, cell, dx = 0, dz = 0, look, scale) {
  return putFacing(piece, cell, dx, dz, look && W(look), scale);
}
function putFacing(piece, cell, dx = 0, dz = 0, look, scale) {
  const [cx, cz] = W(cell);
  const x = round(cx + dx);
  const z = round(cz + dz);
  return { piece, x, z, rot: look ? facing([x, z], look) : 0, ...scale ? { scale } : {} };
}
var place = (piece, x, z, rot = 0, scale, y) => ({
  piece,
  x,
  z,
  rot,
  ...scale ? { scale } : {},
  ...y !== undefined ? { y } : {}
});
var AVENUE = [0, 30];
var DRESSING = [
  place("flag_blue", -5.5, 15.5),
  place("flag_blue", 5.5, 15.5),
  put("building_well_blue", [0, 4], -6.2, 6.5),
  putFacing("building_market_blue", [-1, 7], 1, 0, AVENUE),
  putFacing("building_market_red", [1, 7], -1, -2.5, AVENUE),
  put("crate_A_big", [1, 7], -3.4, 2.2),
  put("barrel", [1, 7], -2.2, 3.4),
  put("sack", [-1, 7], 3.6, 3.2),
  put("building_home_A_red", [-1, 3], -2.5, 1, [-1, 5]),
  put("barrel", [-1, 3], 1.8, 2.4),
  put("building_home_B_blue", [1, 3], 2.5, 1, [1, 5]),
  put("crate_A_small", [1, 3], -1.6, 2.6),
  put("building_home_A_blue", [-3, 3], 1.5, 0, [-3, 5]),
  put("building_home_B_yellow", [-3, 3], -3, -3.5, [-3, 5]),
  put("building_blacksmith_blue", [-3, 1], 0, 0, [0, 1]),
  put("building_home_A_green", [-3, -1], -1, 1, [0, -1]),
  put("building_tavern_blue", [-3, -3], 0, 1, [0, -3]),
  put("building_home_B_red", [-2, -4], 0, -1, [-2, -2]),
  put("building_church_blue", [0, -4], 0, -1, [0, -2]),
  put("building_home_A_yellow", [2, -4], 0, -1, [2, -2]),
  put("building_home_B_green", [-1, -3], 0, -1, [-1, -1]),
  put("building_home_A_blue", [1, -3], 0, -1, [1, -1]),
  put("building_home_B_blue", [3, -3], 0, 0, [5, -3]),
  put("building_barracks_blue", [3, -1], 0, 0, [0, -1]),
  put("building_home_A_red", [3, 1], 0, 0, [5, 1]),
  put("building_home_B_yellow", [3, 3], 0, 1, [3, 5]),
  put("barrel", [3, 3], 3.2, 2.6),
  put("building_home_A_green", [4, -2], 0, 0, [5, -1]),
  put("building_home_B_red", [4, 0], 0, 0, [5, 1]),
  put("building_home_A_yellow", [4, 2], 0, 0, [5, 3]),
  put("building_home_A_blue", [-2, 6], 0, 0, [-1, 5]),
  put("building_home_B_green", [2, 6], 0, 0, [1, 5]),
  put("building_home_B_red", [-2, 6], -3.5, 3, [-1, 5]),
  put("tree_single_A", [-2, 6], 3.5, 3.5),
  put("building_home_A_red", [2, 6], 3.5, 3, [1, 5]),
  put("barrel", [2, 6], -2.5, 3.5),
  put("building_home_B_blue", [-3, -1], 2.5, -3.5, [0, -1]),
  put("building_home_A_yellow", [-3, 1], -2.5, 3.5, [0, 1]),
  put("building_home_A_red", [-1, -3], 3.5, -2.5, [-1, -1]),
  put("building_home_B_green", [3, 1], 3, -3.5, [5, 1]),
  put("tree_single_B", [4, 0], 3.5, 3),
  put("crate_A_big", [4, 2], -3, 3),
  put("tree_single_A", [3, -3], -3.5, -3),
  put("building_home_A_green", [3, 3], -3.5, -2, [3, 5]),
  put("flag_yellow", [0, 6], -4, 0),
  put("flag_yellow", [0, 6], 4, 0),
  put("building_windmill_blue", [5, -5], 0, 0, [4, -4]),
  put("sack", [5, -5], -3, 2.5),
  put("sack", [5, -5], -2.2, 3.3, undefined, 1.1),
  put("building_lumbermill_blue", [-6, 4], 0, 0, [-5, 3]),
  put("resource_lumber", [-6, 4], 3.5, -3.5),
  put("tree_single_A_cut", [-7, 1], 2.5, 1.5),
  put("tree_single_A_cut", [-7, 3], 3, -1),
  put("tree_single_B_cut", [-6, 0], -1, 3.5),
  put("trees_B_cut", [-6, 2], -3.5, -4),
  put("building_watermill_blue", [-5, 9], 1.5, 0, [-4, 9]),
  put("waterplant_A", [-4, 8], 2.5, -2.5),
  put("waterlily_A", [-4, 10], -1, 2),
  put("waterlily_B", [-5, 11], 1, 1),
  put("bucket_water", [-3, 9], -2.5, 3),
  ...WORK.targets.map(([x, z]) => place("target", x, z, facing([x, z], W(PLACES.PROVING)), 1.4)),
  put("building_archeryrange_blue", [5, 9], 0, 0, [4, 8]),
  put("weaponrack", [4, 8], 4, -3, [4, 8]),
  put("tent", [5, 7], 3, 3),
  put("flag_red", [5, 7], -1, -3.5),
  put("building_mine_blue", [3, -11], 0, 1, [3, -9]),
  place("resource_stone", WORK.quarry[0][0], WORK.quarry[0][1] - 1.8, 0.4),
  place("rock_single_D", WORK.quarry[0][0] - 2, WORK.quarry[0][1] + 0.5, 1.2, 1.4),
  place("resource_stone", WORK.quarry[1][0], WORK.quarry[1][1] - 1.8, -0.5),
  place("rock_single_E", WORK.quarry[1][0] + 2, WORK.quarry[1][1], 0.2, 1.4),
  put("wheelbarrow", [3, -9], -3, 2.5, undefined),
  put("pallet", [4, -10], 2.5, 3),
  put("building_tower_A_blue", [-5, -9], 0, 0, [-5, -7]),
  put("rock_single_B", [-5, -9], 4, 2),
  put("resource_lumber", [6, 2], 6, -5.5, undefined),
  put("pallet", [6, 2], -6.5, -4),
  put("wheelbarrow", [6, 2], 7, 4.5),
  put("ladder", [6, 2], -7, 1),
  ...[66, 70, 74, 78].map((z) => place("floor_wood_large", 0, z, 0, 0.2, -0.45)),
  place("floor_wood_large", -4, 78, 0, 0.2, -0.45),
  place("floor_wood_large", 4, 78, 0, 0.2, -0.45),
  place("barrel", 1.3, 66.5, 0, 1, -0.4),
  place("crate_A_big", -1.3, 71, 0.3, 1, -0.4),
  place("rope_bundle_A", 4.5, 78.5, 0, 0.25, -0.4),
  place("crate_long_A", -4.5, 77.5, 1.6, 1, -0.4),
  put("crate_open", [-1, 13], 1.5, -2.5, [0, 12]),
  put("barrel", [-1, 13], 3, -1),
  put("crate_long_A", [1, 13], -2.5, -2, [0, 12]),
  put("rock_single_C", [1, 13], 1.5, 0.5)
];
var TERRACE = HEX_SCALE / 2;
var LEVEL = { H: 1, m: 1, M: 2 };
var WATER = new Set(["~", "o", "r", "#"]);
var OPEN = new Set(["~", "o"]);
var FIELD = new Set(["w", "d"]);
var LEVELS = new Map;
for (const [cell, char] of GRID)
  if (LEVEL[char])
    LEVELS.set(cell, LEVEL[char] ?? 0);
var level = (cell) => LEVELS.get(key(cell)) ?? 0;
for (let changed = true;changed; ) {
  changed = false;
  for (const [id, height] of LEVELS) {
    if (GRID.get(id) !== "H")
      continue;
    const cell = id.split(",").map(Number);
    const lower = [0, 1, 2, 3, 4, 5].filter((dir) => level(step(cell, dir)) < height);
    if (lower.length > 0 && rampOf(cell, lower) === undefined) {
      LEVELS.delete(id);
      changed = true;
    }
  }
}
var cache = new Map;
function rampOf(cell, lower) {
  if (lower.length === 0 || lower.length > 3)
    return;
  if (lower.some((dir) => WATER.has(at(step(cell, dir)))))
    return;
  const run = contiguous(lower);
  if (!run)
    return;
  return run.start + Math.floor((run.length - 1) / 2);
}
function contiguous(dirs) {
  const set = new Set(dirs);
  if (set.size === 6)
    return { start: 0, length: 6 };
  for (let start = 0;start < 6; start++) {
    if (!set.has(start) || set.has((start + 5) % 6))
      continue;
    let length = 0;
    while (set.has((start + length) % 6))
      length++;
    return length === set.size ? { start, length } : undefined;
  }
  return;
}

// packages/hall/src/world/gen/hex.ts
function hash(text) {
  let h = 2166136261;
  for (let i = 0;i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// packages/hall/src/world/gen/biomes.ts
var NAMED = {};
var name = (biome, folders) => {
  for (const folder of folders.split(" "))
    NAMED[folder] = biome;
};
name("village", "src source lib libs app apps packages pkg pkgs cmd internal core server client components crates modules");
name("proving", "test tests spec specs __tests__ e2e bench benches benchmarks fixtures testing testdata");
name("library", "docs doc documentation wiki guides guide examples example website site book");
name("quarry", "assets public static media images img fonts resources res data");
name("forest", "vendor third_party third-party external extern deps node_modules");
name("farms", "scripts script tools bin ci .github .circleci config configs build infra deploy ops");
var KNOWN = {};
var lang = (language, colour, extensions) => {
  for (const ext of extensions.split(" "))
    KNOWN[ext] = [language, colour];
};
lang("TypeScript", "#3178c6", "ts tsx mts cts");
lang("JavaScript", "#f1e05a", "js jsx mjs cjs");
lang("Python", "#3572a5", "py pyi ipynb");
lang("Rust", "#dea584", "rs");
lang("Go", "#00add8", "go");
lang("Java", "#b07219", "java");
lang("Kotlin", "#a97bff", "kt kts");
lang("C", "#555555", "c h");
lang("C++", "#f34b7d", "cc cpp cxx hpp hh");
lang("C#", "#178600", "cs");
lang("Ruby", "#701516", "rb");
lang("PHP", "#4f5d95", "php");
lang("Swift", "#f05138", "swift");
lang("Shell", "#89e051", "sh bash zsh");
lang("HTML", "#e34c26", "html htm");
lang("CSS", "#563d7c", "css scss sass less");
lang("Vue", "#41b883", "vue");
lang("Svelte", "#ff3e00", "svelte");
lang("Markdown", "#083fa1", "md mdx");
lang("JSON", "#292929", "json jsonc");
lang("YAML", "#cb171e", "yml yaml");
lang("Dart", "#00b4ab", "dart");
lang("Lua", "#000080", "lua");
lang("Zig", "#ec915c", "zig");
lang("Elixir", "#6e4a7e", "ex exs");
lang("Haskell", "#5e5086", "hs");
lang("Scala", "#c22d40", "scala");
lang("glTF", "#7a8f4b", "glb gltf");
lang("Image", "#a0a0a0", "png jpg jpeg webp gif svg ico");
var OTHER = { name: "Other", colour: "#8a8a8a", kit: "blue" };
function kitOf(colour) {
  const value = Number.parseInt(colour.slice(1), 16);
  const r = (value >> 16 & 255) / 255;
  const g = (value >> 8 & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.15)
    return "blue";
  const d = max - min;
  const hue = max === r ? ((g - b) / d + 6) % 6 * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  if (hue < 30 || hue >= 300)
    return "red";
  if (hue < 90)
    return "yellow";
  if (hue < 170)
    return "green";
  return "blue";
}
function languageOf(path) {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  if (dot <= 0)
    return OTHER;
  const ext = file.slice(dot + 1).toLowerCase();
  const known = KNOWN[ext];
  if (known)
    return { name: known[0], colour: known[1], kit: kitOf(known[1]) };
  const hue = hash(ext) % 360;
  const colour = hsl(hue, 0.45, 0.5);
  return { name: `.${ext}`, colour, kit: kitOf(colour) };
}
function hsl(hue, s, l) {
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
var DATA = new Set(["Other", "JSON", "YAML", "Image", "glTF", "Markdown"]);
var isData = (language) => DATA.has(language.name) || language.name.startsWith(".");
function dominant(bytesByLanguage) {
  const entries = [...bytesByLanguage.values()].sort((a, b) => a.language.name < b.language.name ? -1 : 1);
  const most = (list) => list.reduce((best, e) => !best || e.bytes > best.bytes ? e : best, undefined);
  const code = most(entries.filter((e) => !isData(e.language)));
  const known = most(entries.filter((e) => DATA.has(e.language.name) && e.language.name !== OTHER.name));
  const unknown = most(entries.filter((e) => e.language.name.startsWith(".")));
  return (code ?? known ?? unknown)?.language ?? OTHER;
}

// packages/hall/src/world/chronicle/assemble.ts
var MAX_UNITS = 64;
var MAX_RELEASES = 200;
function unitColumns(samples, lives) {
  const units = [...lives].map(([name2, life]) => ({
    name: name2,
    ...life.group ? { group: life.group } : {},
    born: life.born,
    ...life.died !== undefined ? { died: life.died } : {},
    language: life.language,
    files: samples.map((sample) => sample.get(name2)?.files ?? 0),
    bytes: samples.map((sample) => sample.get(name2)?.bytes ?? 0)
  }));
  const peak = (unit) => Math.max(0, ...unit.files);
  units.sort((a, b) => peak(b) - peak(a) || (a.name < b.name ? -1 : 1));
  if (units.length <= MAX_UNITS)
    return units;
  const kept = units.filter((unit) => unit.name === "/").concat(units.filter((unit) => unit.name !== "/"));
  const keep = kept.slice(0, MAX_UNITS - 1);
  const pools = new Map;
  for (const unit of kept.slice(MAX_UNITS - 1)) {
    const pool = pools.get(unit.group ?? "") ?? [];
    pool.push(unit);
    pools.set(unit.group ?? "", pool);
  }
  const pooled = [...pools].map(([group, members]) => pool(group, members));
  return [...keep, ...pooled].sort((a, b) => peak(b) - peak(a) || (a.name < b.name ? -1 : 1));
}
function pool(group, members) {
  const sum = (column) => (members[0]?.[column] ?? []).map((_, i) => members.reduce((total, unit) => total + (unit[column][i] ?? 0), 0));
  const deaths = members.map((unit) => unit.died);
  const allDied = deaths.every((died) => died !== undefined);
  return {
    name: group ? `${group}/*` : "*",
    ...group ? { group } : {},
    born: Math.min(...members.map((unit) => unit.born)),
    ...allDied ? { died: Math.max(...deaths) } : {},
    language: members[0]?.language ?? "Other",
    files: sum("files"),
    bytes: sum("bytes"),
    pooled: true
  };
}
function linesWeekly(frequency, weeks, weekOf) {
  const additions = new Array(weeks).fill(0);
  const deletions = new Array(weeks).fill(0);
  for (const [week, added, deleted] of frequency) {
    const i = weekOf(Math.floor(week / 86400));
    additions[i] = (additions[i] ?? 0) + added;
    deletions[i] = (deletions[i] ?? 0) + Math.abs(deleted);
  }
  return { additions, deletions };
}
var SEMVER = /^([\w.-]*?[@/-])?v?(\d+)\.(\d+)(?:\.(\d+))?(.*)$/;
function tidyReleases(all) {
  const sorted = [...all].sort((a, b) => a.day - b.day || (a.tag < b.tag ? -1 : 1));
  const lines = new Map;
  for (const release of sorted) {
    const prefix = SEMVER.exec(release.tag)?.[1] ?? "";
    lines.set(prefix, (lines.get(prefix) ?? 0) + 1);
  }
  const main = [...lines].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? "";
  let last;
  const marked = sorted.map((release) => {
    const match = SEMVER.exec(release.tag);
    const pre = release.prerelease || (match ? /[-+]|alpha|beta|rc|canary|next|experimental/i.test(match[5] ?? "") : false);
    const out = { ...release, ...pre ? { prerelease: true } : {} };
    if (!match || pre || (match[1] ?? "") !== main)
      return out;
    const version = [Number(match[2]), Number(match[3])];
    const major = !last || version[0] > last[0] || version[0] === 0 && last[0] === 0 && version[1] > last[1];
    if (!last || version[0] > last[0] || version[0] === last[0] && version[1] > last[1])
      last = version;
    return major ? { ...out, major: true } : out;
  });
  if (marked.length <= MAX_RELEASES)
    return marked;
  const stable = marked.filter((release) => !release.prerelease);
  if (stable.length <= MAX_RELEASES)
    return stable;
  const seen = new Set;
  const firsts = stable.filter((release) => {
    const match = SEMVER.exec(release.tag);
    const minor = match ? `${match[1] ?? ""}${match[2]}.${match[3]}` : release.tag;
    if (seen.has(minor))
      return false;
    seen.add(minor);
    return true;
  });
  return firsts.slice(-MAX_RELEASES);
}
var KIND_ORDER = [
  "first-commit",
  "release",
  "rename",
  "refactor",
  "born",
  "surge"
];
function milestonesOf(c, moments = {}) {
  const picked = [];
  const founder = [...c.contributors].sort((a, b) => a.first - b.first || b.commits - a.commits)[0];
  picked.push({
    day: c.start,
    kind: "first-commit",
    text: founder && founder.first <= c.start + 7 ? `First commit, by ${founder.name}` : "First commit"
  });
  for (const release of c.releases)
    if (release.major)
      picked.push({ day: release.day, kind: "release", text: `${release.tag} released` });
  for (const rename of top(moments.renames ?? [], 6, (r) => r.files))
    picked.push({
      day: rename.day,
      kind: "rename",
      text: `${rename.from}/ becomes ${rename.to}/`,
      unit: rename.to
    });
  for (const refactor of top(moments.refactors ?? [], 4, (r) => r.files))
    picked.push({
      day: refactor.day,
      kind: "refactor",
      text: `${refactor.files} files reshaped in one commit`
    });
  const peak = (unit) => Math.max(0, ...unit.files);
  const renamedTo = new Set((moments.renames ?? []).map((rename) => rename.to));
  const born = c.units.filter((unit) => !unit.pooled && unit.name !== "/" && unit.born > c.start && !renamedTo.has(unit.name));
  for (const unit of top(born, 12, peak))
    picked.push({ day: unit.born, kind: "born", text: `${unit.name}/ appears`, unit: unit.name });
  for (const surge of surges(c.contributors, c.start))
    picked.push({ day: surge.day, kind: "surge", text: `${surge.joined} new contributors join` });
  const rank = (m) => KIND_ORDER.indexOf(m.kind);
  const kept = [...picked].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_MILESTONES);
  return kept.sort((a, b) => a.day - b.day || rank(a) - rank(b) || (a.text < b.text ? -1 : 1));
}
function surges(contributors, start) {
  const quarters = new Map;
  for (const person of contributors) {
    if (person.bot)
      continue;
    const quarter = Math.floor((person.first - start) / 91);
    quarters.set(quarter, (quarters.get(quarter) ?? 0) + 1);
  }
  const counts = [...quarters.values()].sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] ?? 0;
  const bar = Math.max(5, median * 2);
  const big = [...quarters].filter(([, joined]) => joined >= bar).map(([quarter, joined]) => ({ day: start + quarter * 91, joined }));
  return top(big, 5, (s) => s.joined);
}
function top(list, n, size) {
  return [...list].sort((a, b) => size(b) - size(a) || (a.day ?? a.born ?? 0) - (b.day ?? b.born ?? 0)).slice(0, n);
}

// packages/hall/src/world/chronicle/privacy.ts
var PRIVATE = {
  "codestz/guildhall": ["docs/", ".agents/", ".claude/", "CONTEXT.md", "skills-lock.json"]
};
function privateTo(repo) {
  const rules = PRIVATE[repo.toLowerCase()];
  if (!rules)
    return () => false;
  return (path) => rules.some((rule) => rule.endsWith("/") ? path === rule.slice(0, -1) || path.startsWith(rule) : path === rule);
}
var hasPrivatePaths = (repo) => PRIVATE[repo.toLowerCase()] !== undefined;

// packages/hall/src/world/chronicle/units.ts
var WORKSPACES = new Set(["packages", "apps", "crates", "libs", "services", "modules"]);
function unitOf(path, type = "blob") {
  const parts = path.split("/");
  const top2 = parts[0] ?? "/";
  if (parts.length === 1)
    return type === "commit" ? { name: path } : { name: "/" };
  if (WORKSPACES.has(top2.toLowerCase()) && parts.length > 2)
    return { name: `${top2}/${parts[1]}`, group: top2 };
  return { name: top2 };
}
function tallyUnits(entries) {
  const out = new Map;
  for (const entry of entries) {
    if (entry.type === "tree")
      continue;
    const unit = unitOf(entry.path, entry.type);
    let known = out.get(unit.name);
    if (!known) {
      known = { ...unit, files: 0, bytes: 0, languages: new Map };
      out.set(unit.name, known);
    }
    const bytes = entry.size ?? 0;
    known.files++;
    known.bytes += bytes;
    const language = languageOf(entry.path);
    const sum = known.languages.get(language.name) ?? { language, bytes: 0 };
    sum.bytes += entry.size === undefined ? 1 : bytes;
    known.languages.set(language.name, sum);
  }
  return out;
}
var languageName = (tally) => dominant(tally.languages).name;
function percentages(bytesByLanguage, top2 = 10) {
  const total = [...bytesByLanguage.values()].reduce((sum, bytes) => sum + bytes, 0);
  if (total <= 0)
    return [];
  return [...bytesByLanguage].map(([name2, bytes]) => [name2, Math.round(bytes / total * 1000) / 10]).filter(([, percent]) => percent >= 0.1).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, top2);
}
var DATA2 = new Set(["Other", "JSON", "YAML", "Image", "glTF", "Markdown"]);
var isCode = (name2) => !DATA2.has(name2) && !name2.startsWith(".");
function treeLanguages(entries) {
  const all = new Map;
  for (const entry of entries)
    if (entry.type === "blob") {
      const name2 = languageOf(entry.path).name;
      all.set(name2, (all.get(name2) ?? 0) + (entry.size ?? 0));
    }
  const code = new Map([...all].filter(([name2]) => isCode(name2)));
  return code.size > 0 ? code : all;
}

// packages/hall/src/world/chronicle/deep.ts
function parseStructureLog(text) {
  const out = [];
  let current;
  for (const line of text.split(`
`)) {
    if (line.startsWith("@")) {
      const [sha = "", seconds = "0"] = line.slice(1).split(" ");
      current = { sha, day: dayOf(Number(seconds) * 1000), changes: [] };
      out.push(current);
    } else if (current && line.includes("\t")) {
      const [status = "", ...rest] = line.split("\t");
      current.changes.push([status.slice(0, 1), unquote(rest[rest.length - 1] ?? "")]);
    }
  }
  return out;
}
function parseAuthorLog(text) {
  const out = [];
  let current;
  for (const line of text.split(`
`)) {
    if (line.startsWith("@")) {
      const space = line.indexOf(" ");
      const second = line.indexOf(" ", space + 1);
      const [email = "", name2 = ""] = line.slice(second + 1).split("\t");
      current = {
        sha: line.slice(1, space),
        day: dayOf(Number(line.slice(space + 1, second)) * 1000),
        email: email.toLowerCase(),
        name: name2.trim(),
        paths: []
      };
      out.push(current);
    } else if (current && line.length > 0)
      current.paths.push(unquote(line));
  }
  return out;
}
function unquote(path) {
  if (!path.startsWith('"') || !path.endsWith('"'))
    return path;
  return path.slice(1, -1).replace(/\\(["\\])/g, "$1").replace(/\\t/g, "\t");
}
function pickSnapshots(structure) {
  if (structure.length === 0)
    return [];
  const first = structure[0]?.day ?? 0;
  const last = structure[structure.length - 1]?.day ?? first;
  const years = (last - first) / 365;
  const n = Math.min(structure.length, Math.max(24, Math.min(40, Math.round(24 + 1.5 * years))));
  if (structure.length <= n)
    return structure.map((_, k) => k);
  const total = structure.reduce((sum, commit) => sum + commit.changes.length, 0) || 1;
  const span = last - first || 1;
  const picks = new Set([0, structure.length - 1]);
  let churn = 0;
  let target = 0;
  for (let k = 0;k < structure.length && target < n - 1; k++) {
    const commit = structure[k];
    churn += commit.changes.length;
    const u = 0.5 * ((commit.day - first) / span) + 0.5 * (churn / total);
    while (target < n - 1 && u >= target / Math.max(1, n - 1)) {
      picks.add(k);
      target++;
    }
  }
  for (let i = 1;picks.size < n && i < n; i++) {
    const day = first + span * i / n;
    const k = structure.findIndex((commit, j) => commit.day >= day && !picks.has(j));
    if (k >= 0)
      picks.add(k);
  }
  for (let i = 1;picks.size < n && i < n; i++)
    picks.add(Math.round(i * (structure.length - 1) / n));
  return [...picks].sort((a, b) => a - b);
}
function axisOf(structure, authors = []) {
  const start = structure[0]?.day ?? authors[0]?.day ?? 0;
  const lastAuthor = authors.reduce((most, commit) => Math.max(most, commit.day), start);
  return { start, end: Math.max(structure[structure.length - 1]?.day ?? start, lastAuthor) };
}
function visibleHistory(repo, structure, authors) {
  const hidden = privateTo(repo);
  return {
    structure: structure.map((commit) => ({ ...commit, changes: commit.changes.filter(([, path]) => !hidden(path)) })).filter((commit, i) => commit.changes.length > 0 || (structure[i]?.changes.length ?? 0) === 0),
    authors: authors.map((commit) => ({ ...commit, paths: commit.paths.filter((path) => !hidden(path)) })).filter((commit, i) => commit.paths.length > 0 || (authors[i]?.paths.length ?? 0) === 0)
  };
}
function buildDeep(input) {
  const hidden = privateTo(input.repo);
  const partial = new Set(input.partial ?? []);
  const { structure, authors } = visibleHistory(input.repo, input.structure, input.authors);
  const { start, end } = axisOf(structure, authors);
  const weeks = Math.floor((end - start) / 7) + 1;
  const weekOf = (day) => Math.max(0, Math.min(weeks - 1, Math.floor((day - start) / 7)));
  const picks = pickSnapshots(structure);
  const replay = replayStructure(structure, picks, weekOf, weeks);
  const trees = picks.map((k) => {
    const tree = input.trees?.[structure[k]?.sha ?? ""];
    if (!tree)
      return;
    const entries = tree.entries.filter((entry) => !hidden(entry.path));
    return { tallies: tallyUnits(entries), entries, truncated: !!tree.truncated };
  });
  if (trees.some((tree) => !tree))
    partial.add("bytes");
  const samples = replay.samples.map((counts, i) => {
    const out2 = new Map;
    for (const [name2, files] of counts) {
      const group = unitGroup(name2);
      out2.set(name2, { files, bytes: bytesOf(name2, files, i), ...group ? { group } : {} });
    }
    return out2;
  });
  function bytesOf(name2, files, i) {
    const own = trees[i]?.tallies.get(name2);
    if (own)
      return own.bytes;
    if (trees[i] || files === 0)
      return 0;
    for (let d = 1;d < trees.length; d++)
      for (const j of [i - d, i + d]) {
        const near = trees[j]?.tallies.get(name2);
        if (near && near.files > 0)
          return Math.round(near.bytes / near.files * files);
      }
    return 0;
  }
  const lives = new Map;
  for (const [name2, life] of replay.lives) {
    if (!samples.some((sample) => (sample.get(name2)?.files ?? 0) > 0))
      continue;
    const lastTree = [...trees].reverse().find((tree) => tree?.tallies.has(name2))?.tallies.get(name2);
    lives.set(name2, {
      born: life.born,
      ...life.died !== undefined ? { died: life.died } : {},
      language: languageName(lastTree ?? replay.languages.get(name2)),
      ...unitGroup(name2) ? { group: unitGroup(name2) } : {}
    });
  }
  const units = unitColumns(samples, lives);
  const finalTree = trees[trees.length - 1];
  const snapshots = {
    day: picks.map((k) => structure[k]?.day ?? start),
    sha: picks.map((k) => (structure[k]?.sha ?? "").slice(0, 8)),
    files: replay.totals,
    bytes: samples.map((sample) => [...sample.values()].reduce((sum, unit) => sum + unit.bytes, 0)),
    ...trees.some((tree) => tree?.truncated) ? { truncated: trees.flatMap((tree, i) => tree?.truncated ? [i] : []) } : {}
  };
  const people = contributorsOf(authors, input.logins ?? {}, weekOf);
  const weekly = {
    commits: tally(authors.map((commit) => weekOf(commit.day)), weeks),
    files: replay.weeklyFiles
  };
  if (input.codeFrequency)
    Object.assign(weekly, linesWeekly(input.codeFrequency, weeks, weekOf));
  for (const [key2, series] of Object.entries(input.activity ?? {}))
    if (series?.length === weeks)
      weekly[key2] = series;
    else
      partial.add("prs");
  const languages = !hasPrivatePaths(input.repo) && input.meta?.languages && Object.keys(input.meta.languages).length > 0 ? percentages(new Map(Object.entries(input.meta.languages))) : percentages(treeLanguages(finalTree?.entries ?? []));
  const body = {
    v: CHRONICLE_VERSION,
    depth: "deep",
    generatedAt: input.generatedAt,
    repo: {
      name: input.repo,
      branch: input.branch,
      ...input.meta?.description ? { description: input.meta.description } : {},
      ...input.meta?.stars !== undefined ? { stars: input.meta.stars } : {},
      ...input.meta?.forks !== undefined ? { forks: input.meta.forks } : {},
      ...input.meta?.created ? { created: dayOf(input.meta.created) } : {},
      languages,
      files: snapshots.files[snapshots.files.length - 1] ?? 0,
      bytes: snapshots.bytes[snapshots.bytes.length - 1] ?? 0,
      commits: authors.length,
      contributors: people.total
    },
    start,
    end,
    snapshots,
    units,
    weekly,
    contributors: people.top,
    releases: tidyReleases((input.tags ?? []).filter((tag) => tag.day >= start - 1))
  };
  const out = { ...body, milestones: milestonesOf(body, replay.moments) };
  if (partial.size > 0)
    out.partial = [...partial].sort();
  return out;
}
var unitGroup = (name2) => name2.includes("/") ? name2.split("/")[0] : undefined;
var unitKey = (path) => unitOf(path).name;
function replayStructure(structure, picks, weekOf, weeks) {
  const live = new Set;
  const counts = new Map;
  const lives = new Map;
  const languages = new Map;
  const samples = [];
  const totals = [];
  const weeklyFiles = new Array(weeks).fill(-1);
  const renames = [];
  const refactors = [];
  const pickSet = new Set(picks);
  structure.forEach((commit, k) => {
    const before = live.size;
    const adds = new Map;
    const deletes = new Map;
    for (const [status, path] of commit.changes) {
      const unit = unitKey(path);
      if (status === "A" && !live.has(path)) {
        live.add(path);
        counts.set(unit, (counts.get(unit) ?? 0) + 1);
        adds.set(unit, (adds.get(unit) ?? 0) + 1);
        countLanguage(unit, path, 1);
      } else if (status === "D" && live.delete(path)) {
        counts.set(unit, (counts.get(unit) ?? 1) - 1);
        deletes.set(unit, (deletes.get(unit) ?? 0) + 1);
        countLanguage(unit, path, -1);
      }
    }
    const born = [];
    const died = [];
    for (const unit of new Set([...adds.keys(), ...deletes.keys()])) {
      const now = counts.get(unit) ?? 0;
      const was = now - (adds.get(unit) ?? 0) + (deletes.get(unit) ?? 0);
      const life = lives.get(unit);
      if (was === 0 && now > 0) {
        if (!life) {
          lives.set(unit, { born: commit.day });
          born.push(unit);
        } else
          delete life.died;
      } else if (was > 0 && now === 0 && life) {
        life.died = commit.day;
        died.push(unit);
      }
    }
    const gone = died.sort((a, b) => (deletes.get(b) ?? 0) - (deletes.get(a) ?? 0))[0];
    const fresh = born.sort((a, b) => (adds.get(b) ?? 0) - (adds.get(a) ?? 0))[0];
    const moved = gone && fresh ? deletes.get(gone) ?? 0 : 0;
    if (gone && fresh && moved >= 5 && (adds.get(fresh) ?? 0) >= moved / 2)
      renames.push({ day: commit.day, from: gone, to: fresh, files: moved });
    else if (k > 0 && commit.changes.length >= Math.max(200, before * 0.1))
      refactors.push({ day: commit.day, files: commit.changes.length });
    weeklyFiles[weekOf(commit.day)] = live.size;
    if (pickSet.has(k)) {
      samples.push(new Map([...counts].filter(([, files]) => files > 0)));
      totals.push(live.size);
    }
  });
  let last = 0;
  for (let i = 0;i < weeks; i++)
    last = weeklyFiles[i] = (weeklyFiles[i] ?? -1) < 0 ? last : weeklyFiles[i];
  return { samples, totals, weeklyFiles, lives, languages, moments: { renames, refactors } };
  function countLanguage(unit, path, delta) {
    const known = languages.get(unit) ?? { languages: new Map };
    languages.set(unit, known);
    const language = languageOf(path);
    const sum = known.languages.get(language.name) ?? { language, bytes: 0 };
    sum.bytes += delta;
    known.languages.set(language.name, sum);
  }
}
function tally(indices, weeks) {
  const out = new Array(weeks).fill(0);
  for (const i of indices)
    out[i] = (out[i] ?? 0) + 1;
  return out;
}
var NOREPLY = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/;
var BOT = /\[bot\]|^dependabot|^renovate|-bot$|^github-actions?\b|^actions-user$/i;
function contributorsOf(authors, logins, weekOf) {
  const parent = new Map;
  const find = (key2) => {
    let root = key2;
    while (parent.get(root) !== root)
      root = parent.get(root) ?? root;
    parent.set(key2, root);
    return root;
  };
  const join = (a, b) => {
    const [x, y] = [find(a), find(b)].sort();
    if (x && y && x !== y)
      parent.set(y, x);
  };
  const byLogin = new Map;
  const byName = new Map;
  const loginOf = (email) => logins[email] ?? NOREPLY.exec(email)?.[1];
  for (const commit of authors) {
    const key2 = commit.email || `name:${commit.name}`;
    if (!parent.has(key2))
      parent.set(key2, key2);
    const login = loginOf(commit.email)?.toLowerCase();
    if (login) {
      const known = byLogin.get(login);
      if (known)
        join(known, key2);
      else
        byLogin.set(login, key2);
    }
    const name2 = commit.name.toLowerCase();
    if (name2.split(/\s+/).length >= 2) {
      const known = byName.get(name2);
      if (known)
        join(known, key2);
      else
        byName.set(name2, key2);
    }
  }
  const people = new Map;
  for (const commit of authors) {
    const key2 = find(commit.email || `name:${commit.name}`);
    let person = people.get(key2);
    if (!person) {
      person = {
        key: key2,
        names: new Map,
        commits: 0,
        first: commit.day,
        last: commit.day,
        weeks: new Map,
        touches: new Map
      };
      people.set(key2, person);
    }
    const login = loginOf(commit.email);
    if (login && !person.login)
      person.login = login;
    person.names.set(commit.name, (person.names.get(commit.name) ?? 0) + 1);
    person.commits++;
    person.first = Math.min(person.first, commit.day);
    person.last = Math.max(person.last, commit.day);
    const week = weekOf(commit.day);
    person.weeks.set(week, (person.weeks.get(week) ?? 0) + 1);
    for (const unit of new Set(commit.paths.map(unitKey)))
      person.touches.set(unit, (person.touches.get(unit) ?? 0) + 1);
  }
  const ranked = [...people.values()].map((person) => ({ person, name: nameOf(person) }));
  ranked.sort((a, b) => b.person.commits - a.person.commits || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const top2 = ranked.slice(0, MAX_CONTRIBUTORS).map(({ person, name: name2 }) => {
    const active = [...person.weeks.keys()];
    const from = Math.min(...active);
    const to = Math.max(...active);
    let weeks = "";
    for (let w = from;w <= to; w++)
      weeks += activityChar(person.weeks.get(w) ?? 0);
    const touched = [...person.touches].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const home = touched[0];
    const also = touched.slice(1, 3).filter(([, n]) => home && n >= home[1] * 0.15).map(([unit]) => unit);
    const bot = BOT.test(name2) || BOT.test(person.login ?? "") || BOT.test(person.key);
    return {
      name: name2,
      ...person.login ? { login: person.login } : {},
      ...bot ? { bot: true } : {},
      first: person.first,
      last: person.last,
      commits: person.commits,
      from,
      weeks,
      ...home ? { home: home[0] } : {},
      ...also.length > 0 ? { also } : {}
    };
  });
  return { top: top2, total: people.size };
}
function nameOf(person) {
  return [...person.names].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] || person.login || "unknown";
}

// scripts/chronicle.ts
var BUNDLE = [
  "Codestz/mcpx",
  "Codestz/claude-hindsight",
  "Codestz/Mintroot",
  "Codestz/opencode-cockpit",
  "Codestz/guildhall",
  "anomalyco/opencode",
  "react/react"
];
var ROOT = join(import.meta.dir, "..");
var OUT_DIR = join(ROOT, "packages/hall/public/chronicles");
var WORK2 = join(tmpdir(), "guildhall-chronicle");
var CACHE = join(WORK2, "cache");
var PARALLEL = 2;
var MAX_SEARCH_QUERIES = 120;
var calls = 0;
var token;
async function main() {
  const [command, repo, ...rest] = Bun.argv.slice(2);
  const keep = rest.includes("--keep");
  const outAt = rest.indexOf("--out");
  const out = outAt >= 0 ? rest[outAt + 1] : undefined;
  if (command === "index" && repo) {
    await index(repo, out);
    return;
  }
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || (await run(["gh", "auth", "token"], ROOT).catch(() => "")).trim() || undefined;
  if (!token)
    console.warn("no gh token: GitHub calls are unauthenticated (60 an hour) and may fail soft");
  if (command === "deep" && repo) {
    await deep(repo, out, keep);
  } else if (command === "bundle") {
    for (const one of BUNDLE)
      await deep(one, undefined, keep);
    await index(OUT_DIR, undefined);
  } else {
    console.error("usage: bun scripts/chronicle.ts deep <owner/name> [--out file] [--keep] | bundle | index <dir> [--out file]");
    process.exit(1);
  }
}
async function deep(wanted, out, keep) {
  const began = performance.now();
  const callsBefore = calls;
  const lap = timer();
  const meta = await rest(`repos/${wanted}`);
  if (!meta)
    throw new Error(`GitHub doesn't know ${wanted}`);
  const repo = meta.full_name;
  const branch = meta.default_branch;
  const slug = repo.toLowerCase().replace("/", "__");
  const clone = join(WORK2, `${slug}.git`);
  const partial = [];
  if (!await exists(clone)) {
    await mkdir(WORK2, { recursive: true });
    await git(["clone", "--quiet", "--bare", "--filter=blob:none", `https://github.com/${repo}.git`, clone], WORK2);
  } else
    await git([
      "fetch",
      "--quiet",
      "--filter=blob:none",
      "origin",
      `+refs/heads/${branch}:refs/heads/${branch}`,
      "--tags"
    ], clone);
  const cloned = lap();
  const history = visibleHistory(repo, parseStructureLog(await git([
    "-c",
    "core.quotepath=false",
    "log",
    "--reverse",
    "--first-parent",
    "--diff-merges=first-parent",
    "--no-renames",
    "--name-status",
    "--format=@%H %ct",
    branch
  ], clone)), parseAuthorLog(await git([
    "-c",
    "core.quotepath=false",
    "log",
    "--reverse",
    "--no-merges",
    "--no-renames",
    "--name-only",
    "--format=@%H %at %aE%x09%aN",
    branch
  ], clone)));
  const { structure, authors } = history;
  const tags = (await git(["for-each-ref", "--sort=creatordate", "--format=%(refname:short)%09%(creatordate:unix)", "refs/tags"], clone)).split(`
`).filter(Boolean).map((line) => {
    const [tag = "", seconds = "0"] = line.split("\t");
    return { tag, day: dayOf(Number(seconds) * 1000) };
  });
  const logged = lap();
  const picks = pickSnapshots(structure).map((k) => structure[k]?.sha ?? "");
  const trees = {};
  await parallel(picks, async (sha) => {
    const tree = await treeOf(repo, sha);
    if (tree)
      trees[sha] = tree;
  });
  const soft = (section, fallback) => () => {
    partial.push(section);
    return fallback;
  };
  const names = await releaseNames(repo).catch(soft("releases", {}));
  const logins = await loginsOf(repo, authors).catch(soft("logins", {}));
  const { start, end } = axisOf(structure, authors);
  const activity = await activityOf(repo, start, end).catch((error) => {
    console.warn(`  PR/issue counts skipped: ${error.message}`);
    return;
  });
  const codeFrequency = await codeFrequencyOf(repo);
  const languages = await rest(`repos/${repo}/languages`);
  const fetched = lap();
  const chronicle = buildDeep({
    repo,
    branch,
    generatedAt: new Date().toISOString(),
    meta: {
      ...meta.description ? { description: meta.description } : {},
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      created: meta.created_at,
      ...languages ? { languages } : {}
    },
    structure,
    authors,
    trees,
    tags: tags.map((tag) => ({ ...tag, ...names[tag.tag] ? { name: names[tag.tag] } : {} })),
    logins,
    ...activity ? { activity } : {},
    ...codeFrequency ? { codeFrequency } : {},
    partial
  });
  const json = encodeChronicle(chronicle);
  const gz = Bun.gzipSync(new TextEncoder().encode(json), { level: 9 });
  const file = out ?? join(OUT_DIR, `${slug}.json.gz`);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, gz);
  if (!keep)
    await rm(clone, { recursive: true, force: true });
  const s = (ms) => `${(ms / 1000).toFixed(1)}s`;
  console.log([
    `${repo}  \u2192  ${file.replace(`${ROOT}/`, "")}`,
    `  ${structure.length} mainline / ${authors.length} authored commits, ${chronicle.units.length} units, ${chronicle.snapshots.day.length} samples, ${chronicle.contributors.length}/${chronicle.repo.contributors} contributors, ${chronicle.releases.length} releases, ${chronicle.milestones.length} milestones`,
    `  ${isoOf(chronicle.start)} \u2192 ${isoOf(chronicle.end)}  \xB7  ${chronicle.repo.files} files, ${(chronicle.repo.bytes / 1e6).toFixed(1)} MB today`,
    `  size ${(json.length / 1024).toFixed(1)} KB raw, ${(gz.length / 1024).toFixed(1)} KB gz`,
    `  time ${s(performance.now() - began)} (clone ${s(cloned)}, logs ${s(logged)}, GitHub ${s(fetched)}), ${calls - callsBefore} API calls`,
    chronicle.partial ? `  partial: ${chronicle.partial.join(", ")}` : ""
  ].filter(Boolean).join(`
`));
}
async function index(dir, out) {
  const files = (await readdir(dir)).filter((name2) => name2.endsWith(".json.gz")).sort();
  const chronicles = [];
  for (const name2 of files)
    chronicles.push(await readChronicle(new Uint8Array(await readFile(join(dir, name2)))));
  const catalog = buildCatalog(chronicles, new Date().toISOString());
  const file = out ?? join(dir, "index.json");
  await writeFile(file, `${JSON.stringify(catalog, null, 1)}
`);
  console.log(`${catalog.repos.length} chronicles  \u2192  ${file.replace(`${ROOT}/`, "")}`);
}
async function treeOf(repo, sha) {
  return cached(`tree-${sha}`, async () => {
    const listing = await rest(`repos/${repo}/git/trees/${sha}?recursive=1`);
    if (!listing)
      return;
    const entries = (listing.tree ?? []).filter((entry) => entry.type === "blob" || entry.type === "commit").map(({ path, type, size }) => type === "blob" ? { path, type, size: size ?? 0 } : { path, type: "commit" });
    return { entries, ...listing.truncated ? { truncated: true } : {} };
  });
}
async function releaseNames(repo) {
  const out = {};
  for (let page = 1;page <= 3; page++) {
    const list = await rest(`repos/${repo}/releases?per_page=100&page=${page}`);
    for (const release of list ?? [])
      if (release.name && release.name !== release.tag_name)
        out[release.tag_name] = release.name;
    if (!list || list.length < 100)
      break;
  }
  return out;
}
async function loginsOf(repo, authors) {
  const byEmail = new Map;
  for (const commit of authors) {
    if (!commit.email || commit.email.endsWith("@users.noreply.github.com"))
      continue;
    const known = byEmail.get(commit.email);
    if (known)
      known.commits++;
    else
      byEmail.set(commit.email, { sha: commit.sha, commits: 1 });
  }
  const busiest = [...byEmail].sort((a, b) => b[1].commits - a[1].commits).slice(0, 400);
  const [owner, name2] = repo.split("/");
  const out = {};
  const batches = [];
  for (let i = 0;i < busiest.length; i += 100)
    batches.push(busiest.slice(i, i + 100));
  await parallel(batches, async (batch) => {
    const key2 = `logins-${Bun.hash(batch.map(([, { sha }]) => sha).join(",")).toString(16)}`;
    const found = await cached(key2, async () => {
      const fields = batch.map(([, { sha }], i) => `c${i}: object(oid: "${sha}") { ... on Commit { author { user { login } } } }`).join(" ");
      const data = await graphql(`query { repository(owner: "${owner}", name: "${name2}") { ${fields} } }`);
      return batch.map((_, i) => data.repository?.[`c${i}`]?.author?.user?.login ?? "");
    });
    batch.forEach(([email], i) => {
      if (found?.[i])
        out[email] = found[i];
    });
  });
  return out;
}
var SERIES = {
  prsOpened: (r, a, b) => `repo:${r} is:pr created:${a}..${b}`,
  prsMerged: (r, a, b) => `repo:${r} is:pr is:merged merged:${a}..${b}`,
  prsClosed: (r, a, b) => `repo:${r} is:pr is:unmerged closed:${a}..${b}`,
  issuesOpened: (r, a, b) => `repo:${r} is:issue created:${a}..${b}`,
  issuesClosed: (r, a, b) => `repo:${r} is:issue closed:${a}..${b}`
};
async function activityOf(repo, start, end) {
  const weeks = Math.floor((end - start) / 7) + 1;
  const today = dayOf(Date.now());
  const asks = [];
  for (const series of Object.keys(SERIES))
    for (let week = 0;week < weeks; week++) {
      const from = start + week * 7;
      asks.push({
        series,
        week,
        query: SERIES[series](repo, isoOf(from), isoOf(from + 6)),
        final: from + 6 < today - 1
      });
    }
  const batches = [];
  for (let i = 0;i < asks.length; i += 50)
    batches.push(asks.slice(i, i + 50));
  if (batches.length > MAX_SEARCH_QUERIES)
    throw new Error(`${batches.length} search queries is over the budget`);
  const out = Object.fromEntries(Object.keys(SERIES).map((series) => [series, new Array(weeks).fill(0)]));
  await parallel(batches, async (batch) => {
    const key2 = `search-${Bun.hash(batch.map((ask) => ask.query).join("|")).toString(16)}`;
    const fetch2 = async () => {
      const fields = batch.map((ask, i) => `w${i}: search(type: ISSUE, query: ${JSON.stringify(ask.query)}, first: 0) { issueCount }`).join(" ");
      const data = await graphql(`query { ${fields} }`);
      return batch.map((_, i) => data[`w${i}`]?.issueCount ?? 0);
    };
    const counts = batch.every((ask) => ask.final) ? await cached(key2, fetch2) : await fetch2();
    batch.forEach((ask, i) => {
      out[ask.series][ask.week] = counts?.[i] ?? 0;
    });
  });
  return out;
}
async function codeFrequencyOf(repo) {
  for (let attempt = 0;attempt < 4; attempt++) {
    calls++;
    const response = await fetch(`https://api.github.com/repos/${repo}/stats/code_frequency`, {
      headers: headers()
    });
    if (response.status === 200) {
      const body = await response.json();
      return Array.isArray(body) && body.length > 0 ? body : undefined;
    }
    if (response.status !== 202)
      return;
    await Bun.sleep(3000);
  }
  return;
}
function headers() {
  return {
    Accept: "application/vnd.github+json",
    ...token ? { Authorization: `Bearer ${token}` } : {}
  };
}
async function rest(path) {
  calls++;
  const response = await fetch(`https://api.github.com/${path}`, { headers: headers() });
  if (!response.ok) {
    console.warn(`  GitHub ${response.status} for ${path}`);
    return;
  }
  return response.json();
}
async function graphql(query) {
  calls++;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query })
  });
  const body = await response.json();
  if (!response.ok || !body.data)
    throw new Error(body.errors?.[0]?.message ?? `GraphQL answered ${response.status}`);
  return body.data;
}
async function cached(key2, make) {
  const file = join(CACHE, `${key2}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    const made = await make();
    if (made !== undefined) {
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, JSON.stringify(made));
    }
    return made;
  }
}
async function parallel(items, work) {
  let next = 0;
  const lane = async () => {
    while (next < items.length)
      await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, lane));
}
function git(args, cwd) {
  return run(["nice", "-n", "10", "git", ...args], cwd, { GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" });
}
async function run(command, cwd, env = {}) {
  const child = Bun.spawn(command, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  if (code !== 0)
    throw new Error(`${command.join(" ")} failed (${code}): ${err.trim()}`);
  return out;
}
async function exists(path) {
  return stat(path).then(() => true, () => false);
}
function timer() {
  let last = performance.now();
  return () => {
    const now = performance.now();
    const lap = now - last;
    last = now;
    return lap;
  };
}
await main();
