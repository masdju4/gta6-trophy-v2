// main.ts — Leonida Legend submission program (Node 22, standard library only).
// Hands the entry in: copies app/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, default /output) and writes dossier.json as the exact
// bytes the vendored make.fun library returns. Deterministic: no timestamps, no random
// values — two runs over the same repository write identical bytes.
//
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Try the app:  node serve.ts  →  http://localhost:8080

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// Validate the guide before handing it in: the gate refuses an entry missing its page,
// and the trophy file must parse and name all 55 official trophies.
const indexPath = join(repoRoot, 'app', 'index.html');
const trophiesPath = join(repoRoot, 'app', 'data', 'trophies.json');
if (!existsSync(indexPath)) fail('app/index.html is missing');
if (!existsSync(trophiesPath)) fail('app/data/trophies.json is missing');

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(trophiesPath, 'utf8'));
} catch (error) {
  fail(`app/data/trophies.json does not parse: ${error instanceof Error ? error.message : String(error)}`);
}
// The kit's shape is {"trophies":[...]}; a bare array is accepted too.
const trophyList = Array.isArray(parsed) ? parsed : (parsed as { trophies?: unknown })?.trophies;
if (!Array.isArray(trophyList)) fail('app/data/trophies.json holds no trophies array');
if (trophyList.length < 55) fail(`app/data/trophies.json holds ${trophyList.length} trophies, the official list has 55`);
// The gate also refuses a trophy with no name or a blank guide — catch that here too.
for (const [index, entry] of trophyList.entries()) {
  const item = entry as { name?: unknown; guide?: unknown };
  if (typeof item?.name !== 'string' || !item.name.trim()) fail(`trophy ${index + 1} has no name`);
  if (typeof item.guide !== 'string' || !item.guide.trim()) fail(`trophy "${item.name}" has a blank guide`);
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: text_max_bytes shapes the judge text; the others refuse what
// the scorer would refuse (4 screenshots at 256 KiB each, 993 app entries at 48 MiB).
// buildDossier returns canonical JSON bytes; write them unchanged so the gate's own
// rebuild matches byte for byte.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`leonida-legend: handed in ${trophyList.length} trophies, dossier ${dossier.byteLength} bytes -> ${outputDir}`);