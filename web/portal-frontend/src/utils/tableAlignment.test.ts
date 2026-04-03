import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceRoot = path.resolve(__dirname, '..');
const deprecatedAlignRegex = /align:\s*['"](left|right)['"]/;

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('table column alignment', () => {
  it('avoids deprecated left/right values', async () => {
    const files = await collectSourceFiles(sourceRoot);
    const matches: string[] = [];

    await Promise.all(
      files.map(async (filePath) => {
        const contents = await readFile(filePath, 'utf-8');
        if (deprecatedAlignRegex.test(contents)) {
          const relativePath = path.relative(sourceRoot, filePath);
          matches.push(relativePath);
        }
      }),
    );

    expect(matches).toEqual([]);
  });
});
