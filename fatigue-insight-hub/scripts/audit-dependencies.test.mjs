import assert from 'node:assert/strict';
import test from 'node:test';
import { assessAudit } from './audit-dependencies.mjs';

const advisory = { name: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' };
const report = (findings = {}) => ({ metadata: { vulnerabilities: { total: Object.keys(findings).length } }, vulnerabilities: findings });
const finding = (name, via) => ({ nodes: [`node_modules/${name}`], via });
const lock = { packages: { 'node_modules/braces': { dev: true }, 'node_modules/chokidar': { dev: true } } };

// npm's CI response propagates the same advisory through Tailwind's peer
// dependants, whereas some registry responses stop at Tailwind itself.
function peerDependencyReport() {
  return report({
    '@tailwindcss/typography': finding('@tailwindcss/typography', ['tailwindcss']),
    braces: finding('braces', [advisory]),
    chokidar: finding('chokidar', ['braces']),
    'fast-glob': finding('fast-glob', ['micromatch']),
    micromatch: finding('micromatch', ['braces']),
    tailwindcss: finding('tailwindcss', ['chokidar', 'fast-glob', 'micromatch']),
    'tailwindcss-animate': finding('tailwindcss-animate', ['tailwindcss']),
  });
}

const peerLock = () => ({ packages: Object.fromEntries(Object.keys(peerDependencyReport().vulnerabilities)
  .map(name => [`node_modules/${name}`, { dev: true }])) });

test('accepts a report without advisories', () => {
  assert.deepEqual(assessAudit(report(), lock), { deferred: [], blocking: [] });
});

test('defers only the documented build dependency chain', () => {
  assert.deepEqual(assessAudit(report({ braces: finding('braces', [advisory]), chokidar: finding('chokidar', ['braces']) }), lock),
    { deferred: ['braces', 'chokidar'], blocking: [] });
});

test('handles the CI advisory shape including both development-only Tailwind peer plugins', () => {
  const audit = peerDependencyReport();
  assert.deepEqual(assessAudit(audit, peerLock()), { deferred: Object.keys(audit.vulnerabilities), blocking: [] });
});

test('blocks either Tailwind peer plugin if it becomes a production dependency', () => {
  for (const name of ['@tailwindcss/typography', 'tailwindcss-animate']) {
    const productionLock = peerLock();
    delete productionLock.packages[`node_modules/${name}`].dev;
    assert.deepEqual(assessAudit(peerDependencyReport(), productionLock).blocking, [name]);
  }
});

test('blocks a shared runtime path even when the same advisory also has a development path', () => {
  const audit = peerDependencyReport();
  const mixedLock = peerLock();
  const runtimePath = 'node_modules/runtime/node_modules/braces';
  audit.vulnerabilities.braces.nodes.push(runtimePath);
  mixedLock.packages[runtimePath] = {};
  assert.deepEqual(assessAudit(audit, mixedLock).blocking, ['braces']);
});

test('does not defer a new advisory on the now-recognised Tailwind plugins', () => {
  const audit = peerDependencyReport();
  audit.vulnerabilities['tailwindcss-animate'].via.push({ name: 'tailwindcss-animate', url: 'https://github.com/advisories/new-advisory' });
  assert.deepEqual(assessAudit(audit, peerLock()).blocking, ['tailwindcss-animate']);
});

test('blocks the same advisory if the dependency ships in production', () => {
  assert.deepEqual(assessAudit(report({ braces: finding('braces', [advisory]) }), { packages: { 'node_modules/braces': {} } }),
    { deferred: [], blocking: ['braces'] });
});

test('blocks new advisories even inside the documented dependency chain', () => {
  assert.deepEqual(assessAudit(report({ braces: finding('braces', [advisory, { ...advisory, url: 'https://github.com/advisories/new-advisory' }]) }), lock),
    { deferred: [], blocking: ['braces'] });
});

test('blocks unrelated tooling findings and missing dependency provenance', () => {
  const findings = { other: finding('other', [advisory]), braces: finding('braces', [advisory]) };
  assert.deepEqual(assessAudit(report(findings), { packages: {} }), { deferred: [], blocking: ['other', 'braces'] });
});

test('rejects incomplete reports and registry errors', () => {
  assert.throws(() => assessAudit({}, lock));
  assert.throws(() => assessAudit({ ...report(), error: { code: 'ENOAUDIT' } }, lock));
});
