import assert from 'node:assert/strict';
import test from 'node:test';
import { assessAudit } from './audit-dependencies.mjs';

const advisory = { name: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' };
const report = (findings = {}) => ({ metadata: { vulnerabilities: { total: Object.keys(findings).length } }, vulnerabilities: findings });
const finding = (name, via) => ({ nodes: [`node_modules/${name}`], via });
const lock = { packages: { 'node_modules/braces': { dev: true }, 'node_modules/chokidar': { dev: true } } };

test('accepts a report without advisories', () => {
  assert.deepEqual(assessAudit(report(), lock), { deferred: [], blocking: [] });
});

test('defers only the documented build dependency chain', () => {
  assert.deepEqual(assessAudit(report({ braces: finding('braces', [advisory]), chokidar: finding('chokidar', ['braces']) }), lock),
    { deferred: ['braces', 'chokidar'], blocking: [] });
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
