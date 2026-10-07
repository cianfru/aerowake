import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// No patched braces release exists as of 2026-10-07. Tailwind 3 uses it only
// while building trusted source files. Keep this exception narrow: unrelated
// advisories, production dependencies and failures to run the audit must fail CI.
const BUILD_ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const BUILD_CHAIN = new Set(['braces', 'chokidar', 'micromatch', 'fast-glob', 'tailwindcss']);

export function assessAudit(report, lock) {
  if (report?.error || !report?.metadata?.vulnerabilities || !report?.vulnerabilities || !lock?.packages) {
    throw new Error('Dependency audit did not return a complete report.');
  }

  const deferred = [];
  const blocking = [];
  for (const [name, finding] of Object.entries(report.vulnerabilities)) {
    const developmentOnly = finding.nodes?.length > 0 &&
      finding.nodes.every(path => lock.packages[path]?.dev === true);
    const knownBuildAdvisory = BUILD_CHAIN.has(name) && finding.via?.length > 0 &&
      finding.via.every(source => typeof source === 'string'
        ? BUILD_CHAIN.has(source) && Boolean(report.vulnerabilities[source])
        : source.name === 'braces' && source.url === BUILD_ADVISORY);
    (developmentOnly && knownBuildAdvisory ? deferred : blocking).push(name);
  }
  return { deferred, blocking };
}

function main() {
  const audit = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (audit.error || audit.signal || ![0, 1].includes(audit.status)) {
    throw new Error(`npm audit could not complete: ${audit.error?.message || audit.stderr || audit.signal || audit.status}`);
  }
  const report = JSON.parse(audit.stdout);
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const { deferred, blocking } = assessAudit(report, lock);
  if (deferred.length) {
    console.warn(`::warning::Unpatched build-only braces advisory (${deferred.join(', ')}): ${BUILD_ADVISORY}. Reassess when a patched release or Tailwind migration is available.`);
  }
  if (blocking.length) {
    console.error(JSON.stringify(report, null, 2));
    throw new Error(`Dependency audit requires fixes: ${blocking.join(', ')}`);
  }
  console.log(`Dependency policy passed; ${deferred.length} known build-only findings, no other advisories.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
