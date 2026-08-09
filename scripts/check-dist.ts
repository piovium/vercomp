import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const forbidden = [
  '"description":',
  '"rawDescription":',
  '"playCost":',
  '"maxEnergy":',
];

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(filename) : [filename];
    }),
  );
  return nested.flat();
}

const dist = path.resolve("dist");
for (const filename of await filesBelow(dist)) {
  if (!/\.(?:js|json|html|css)$/.test(filename)) continue;
  const content = await readFile(filename, "utf8");
  const match = forbidden.find((needle) => content.includes(needle));
  if (match) {
    throw new Error(`${filename} 包含禁止打包的数据字段 ${match}`);
  }
}
console.log("Verified dist: no source description/value fields were bundled.");
