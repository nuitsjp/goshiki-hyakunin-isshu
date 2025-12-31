import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('CI lint workflow', () => {
  it('package.json に npm run all が定義されている', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));

    expect(pkg.scripts.all).toBeTypeOf('string');
    expect(pkg.scripts.all).toMatch(/npm\s+run\s+lint/);
    expect(pkg.scripts.all).toMatch(/npm\s+test/);
  });

  it('.github/workflows/test.yml で lint が実行される', async () => {
    const workflow = await readFile('.github/workflows/test.yml', 'utf8');

    expect(workflow).toContain('npm run lint');
  });

  it('.github/workflows/test.yml の paths に CSS/HTML が含まれる', async () => {
    const workflow = await readFile('.github/workflows/test.yml', 'utf8');

    expect(workflow).toContain('src/css/**');
    expect(workflow).toContain('src/**/*.html');
  });
});
