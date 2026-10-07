'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('shared country/alias catalogues reproduce the existing complete flag import without changing artwork', () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'herald-flag-catalog-'));
  const manifest = (filename) =>
    JSON.parse(
      fs.readFileSync(filename, 'utf8').match(/window\.HVFlagAssets\s*=\s*(\{[\s\S]*\});/)[1],
    );
  try {
    fs.mkdirSync(path.join(work, 'data'));
    fs.mkdirSync(path.join(work, 'assets'));
    for (const file of ['country-catalog.json', 'flag-name-aliases.json']) {
      fs.copyFileSync(path.join(root, 'data', file), path.join(work, 'data', file));
    }
    for (const directory of ['flags', 'flags-extra']) {
      fs.symlinkSync(
        path.join(root, 'assets', directory),
        path.join(work, 'assets', directory),
        'dir',
      );
    }
    fs.copyFileSync(
      path.join(root, 'assets/slaps-countries.js'),
      path.join(work, 'assets/slaps-countries.js'),
    );
    execFileSync('python3', [path.join(root, 'scripts/import-slaps-flags.py')], {
      cwd: work,
      stdio: 'pipe',
    });
    assert.deepEqual(
      manifest(path.join(work, 'assets/flag-manifest.js')),
      manifest(path.join(root, 'assets/flag-manifest.js')),
    );
    const countries = require('../data/country-catalog.json');
    assert.equal(new Set(countries.map((country) => country.code)).size, countries.length);
    assert.equal(
      Object.keys(manifest(path.join(work, 'assets/flag-manifest.js'))).length,
      countries.length - 1,
    );
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});
