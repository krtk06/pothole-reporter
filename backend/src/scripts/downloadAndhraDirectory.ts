import fs from "fs";
import path from "path";

const SERVICE_URL = "https://livingatlas.esri.in/server/rest/services/IAB2024/Village_Demographics_2024/MapServer/0/query";
const PAGE_SIZE = 2000;
const STATE_NAME = "Andhra Pradesh";

type DirectoryRecord = {
  villageCode: string;
  village: string;
  subdistrictCode: string;
  subdistrict: string;
  districtCode: string;
  district: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

async function queryPage(offset: number) {
  const url = new URL(SERVICE_URL);
  url.searchParams.set("where", "state = 'Andhra Pradesh'");
  url.searchParams.set("outFields", "lgd_villagecode,lgd_villagename,lgd_subdistrictcode,subdistrict,lgd_districtcode,district,name");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(PAGE_SIZE));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Living Atlas request failed with HTTP ${response.status}`);
  }
  const data = await response.json() as { features?: Array<{ attributes: Record<string, unknown> }>; error?: unknown };
  if (data.error) {
    throw new Error(`Living Atlas error: ${JSON.stringify(data.error)}`);
  }
  return data.features ?? [];
}

async function main() {
  const records = new Map<string, DirectoryRecord>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const features = await queryPage(offset);
    for (const feature of features) {
      const attributes = feature.attributes;
      const villageCode = clean(attributes.lgd_villagecode);
      if (!villageCode) continue;
      records.set(villageCode, {
        villageCode,
        village: clean(attributes.lgd_villagename || attributes.name),
        subdistrictCode: clean(attributes.lgd_subdistrictcode),
        subdistrict: clean(attributes.subdistrict),
        districtCode: clean(attributes.lgd_districtcode),
        district: clean(attributes.district),
      });
    }

    process.stdout.write(`Downloaded ${records.size} Andhra records\r`);
    if (features.length < PAGE_SIZE) break;
  }

  const villages = [...records.values()]
    .filter((record) => record.village && record.subdistrict && record.district)
    .sort((a, b) =>
      a.district.localeCompare(b.district) ||
      a.subdistrict.localeCompare(b.subdistrict) ||
      a.village.localeCompare(b.village)
    );

  const output = {
    source: "LGD administrative directory via India Living Atlas",
    state: STATE_NAME,
    villages,
  };

  const outPath = path.resolve(__dirname, "../../../frontend/src/data/andhraDirectory.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${villages.length} records to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
