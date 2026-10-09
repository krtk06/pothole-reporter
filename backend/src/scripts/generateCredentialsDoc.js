// SECURITY: this script renders a human-readable admin directory that contains
// LIVE admin accounts and a PLAINTEXT password.
//
// - The password is never hardcoded here. It must be supplied via ADMIN_PASSWORD
//   so it does not end up committed in source control.
// - The output path is overridable and defaults to a gitignored filename, so
//   the generated file cannot be accidentally committed.
//
// For a shareable, secret-free roster of the same accounts use
// admin-roster.csv / admin-roster.json at the repository root instead.
const fs = require('fs');
const path = require('path');
const andhra = require(path.join(__dirname, '../../../frontend/src/data/andhraDirectory.json'));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error(
    'Refusing to generate: set ADMIN_PASSWORD in the environment.\n' +
    'Example: ADMIN_PASSWORD=\'…\' node src/scripts/generateCredentialsDoc.js\n' +
    'Never hardcode the password in this file.'
  );
  process.exit(1);
}

const OUT_FILE =
  process.env.ADMIN_CREDENTIALS_OUT || path.join(__dirname, '../../../../ADMIN_CREDENTIALS.md');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

const districts = [...new Set(andhra.villages.map(v => v.district).filter(Boolean))].sort();
const mandalMap = new Map();
districts.forEach(d => mandalMap.set(d, new Set()));

andhra.villages.forEach(v => {
  if (v.district && v.subdistrict) {
    mandalMap.get(v.district)?.add(v.subdistrict);
  }
});

let md = '# Andhra Pradesh Admin Credentials Directory\n\n';
md += '> **DO NOT COMMIT.** This file contains live admin accounts and a plaintext\n';
md += '> password. It is gitignored. Distribute through a password manager or an\n';
md += '> encrypted channel, and rotate the password after use.\n\n';
md += '> **Admin Portal:** https://pothole-reporter-blue.vercel.app/login (Admin Login)\n\n';

md += '## 1. State Level Administrator (Full Statewide Control)\n\n';
md += '| Role | Email | Password | Scope | Geographic Coverage |\n';
md += '| :--- | :--- | :--- | :--- | :--- |\n';
md += '| **State Admin** | `admin@pothole.gov.in` | `' + ADMIN_PASSWORD + '` | `state` | Entire State (All 26 Districts & 675 Mandals) |\n\n';

md += '## 2. District Administrators (26 Districts)\n\n';
md += '| District | Admin Email | Password | Admin Scope |\n';
md += '| :--- | :--- | :--- | :--- |\n';

districts.forEach(d => {
  const dSlug = slugify(d);
  md += '| **' + d + '** | `admin.' + dSlug + '@pothole.gov.in` | `' + ADMIN_PASSWORD + '` | `district` (' + d + ') |\n';
});

md += '\n## 3. Mandal Administrators (675 Mandals by District)\n\n';

districts.forEach(d => {
  const dSlug = slugify(d);
  const mandals = [...(mandalMap.get(d) || [])].sort();
  md += '### ' + d + ' District (' + mandals.length + ' Mandals)\n\n';
  md += '| Mandal Name | Admin Email | Password | Scope |\n';
  md += '| :--- | :--- | :--- | :--- |\n';
  mandals.forEach(m => {
    const mSlug = slugify(m);
    md += '| ' + m + ' | `admin.' + mSlug + '.' + dSlug + '@pothole.gov.in` | `' + ADMIN_PASSWORD + '` | `mandal` (' + m + ', ' + d + ') |\n';
  });
  md += '\n';
});

fs.writeFileSync(OUT_FILE, md, 'utf-8');
console.log(
  'Wrote ' +
    OUT_FILE +
    ' (' +
    districts.length +
    ' districts, 675 mandals). This file is gitignored — do not commit it.'
);

