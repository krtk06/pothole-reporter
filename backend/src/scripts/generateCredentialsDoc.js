const fs = require('fs');
const path = require('path');
const andhra = require(path.join(__dirname, '../../../frontend/src/data/andhraDirectory.json'));

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
md += '> **Default Password for All Admin Accounts:** `Admin@123456`\n';
md += '> **Admin Portal Link:** [https://pothole-reporter-blue.vercel.app/login](https://pothole-reporter-blue.vercel.app/login) (Under "Admin Login")\n\n';

md += '## 1. State Level Administrator (Full Statewide Control)\n\n';
md += '| Role | Email | Password | Scope | Geographic Coverage |\n';
md += '| :--- | :--- | :--- | :--- | :--- |\n';
md += '| **State Admin** | `admin@pothole.gov.in` | `Admin@123456` | `state` | Entire State (All 26 Districts & 675 Mandals) |\n\n';

md += '## 2. District Administrators (26 Districts)\n\n';
md += '| District | Admin Email | Password | Admin Scope |\n';
md += '| :--- | :--- | :--- | :--- |\n';

districts.forEach(d => {
  const dSlug = slugify(d);
  md += `| **${d}** | \`admin.${dSlug}@pothole.gov.in\` | \`Admin@123456\` | \`district\` (${d}) |\n`;
});

md += '\n## 3. Mandal Administrators (675 Mandals by District)\n\n';

districts.forEach(d => {
  const dSlug = slugify(d);
  const mandals = [...(mandalMap.get(d) || [])].sort();
  md += `### ${d} District (${mandals.length} Mandals)\n\n`;
  md += '| Mandal Name | Admin Email | Password | Scope |\n';
  md += '| :--- | :--- | :--- | :--- |\n';
  mandals.forEach(m => {
    const mSlug = slugify(m);
    md += `| ${m} | \`admin.${mSlug}.${dSlug}@pothole.gov.in\` | \`Admin@123456\` | \`mandal\` (${m}, ${d}) |\n`;
  });
  md += '\n';
});

fs.writeFileSync('ADMIN_CREDENTIALS.md', md, 'utf-8');
console.log(`ADMIN_CREDENTIALS.md generated successfully with ${districts.length} districts and 675 mandals.`);
