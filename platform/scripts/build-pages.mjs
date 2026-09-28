import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const platformDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(platformDir, 'dist');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(resolve(platformDir, 'public'), outputDir, { recursive: true });
await cp(resolve(platformDir, 'pages', '_worker.js'), resolve(outputDir, '_worker.js'));

console.log(`Cloudflare Pages bundle built at ${outputDir}`);
