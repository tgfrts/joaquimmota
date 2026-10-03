import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const snapshotPath = process.argv[2];
if (!snapshotPath) throw new Error('Pass the read-only target Sanity sample snapshot path. See README.');
const evidence = JSON.parse(await readFile(new URL('../../docs/migration/sample-data-parity.json', import.meta.url), 'utf8'));
const snapshot = JSON.parse(await readFile(resolve(snapshotPath), 'utf8'));
const expected = new Map(evidence.samples.map(sample => [
  [sample.identity.type, sample.identity.legacyId, sample.identity.locale].join(':'), sample.sourceSlug,
]));
if (!Array.isArray(snapshot.documents) || snapshot.documents.length !== expected.size) throw new Error('Preview requires exactly the 11 authorized samples.');
const seen = new Set();
for (const document of snapshot.documents) {
  const key = [document._type, document.legacyId, document.locale].join(':');
  if (!expected.has(key) || seen.has(key) || !document._id?.startsWith('drafts.') || document.sourceSlug !== expected.get(key) || document.slug?.current !== expected.get(key)) {
    throw new Error('Snapshot identity, draft status or original slug does not match the approved sample evidence.');
  }
  seen.add(key);
}
const destination = new URL('../../src/data/sample-content.json', import.meta.url);
await mkdir(new URL('../../src/data/', import.meta.url), { recursive: true });
await writeFile(destination, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Prepared ${seen.size} target-draft samples for local preview; no provider mutation or publication.`);
