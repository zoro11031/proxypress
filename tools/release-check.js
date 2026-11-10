// Keep the tag, desktop packages and AUR download paths on the same version.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('electron/package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('electron/package-lock.json', 'utf8'));
assert.equal(lock.version, pkg.version, 'lockfile version');
assert.equal(lock.packages[''].version, pkg.version, 'lockfile root package version');
const aur = fs.readFileSync('aur/PKGBUILD', 'utf8');
const info = fs.readFileSync('aur/.SRCINFO', 'utf8');
assert.equal(aur.match(/^pkgver=(.+)$/m)?.[1], pkg.version, 'AUR version');
assert.equal(info.match(/^\s*pkgver = (.+)$/m)?.[1], pkg.version, 'AUR source metadata version');
assert.ok(info.includes(`/v${pkg.version}/Proxy-Press-${pkg.version}.deb`), 'AUR download URL');
assert.ok(fs.readFileSync('RELEASE_NOTES.md', 'utf8').startsWith(`# Proxy Press v${pkg.version}\n`), 'release notes version');
for (const platform of ['win', 'linux']) assert.equal(pkg.build[platform].artifactName, 'Proxy-Press-${version}.${ext}', `${platform} download filename`);
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, 'v' + pkg.version, 'release tag must match package version');
console.log('PASS release metadata: v' + pkg.version);
