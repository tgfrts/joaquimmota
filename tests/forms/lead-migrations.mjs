import { readdir, readFile } from 'node:fs/promises';

const directory = new URL('../../migrations/', import.meta.url);
const files = (await readdir(directory)).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
export const leadSchemaSql = (await Promise.all(files.map(name => readFile(new URL(name, directory), 'utf8')))).join('\n');
