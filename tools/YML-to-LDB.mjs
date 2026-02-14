import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";

const SRC_PATH = "./packs-src";
const yaml = true;
const folders = true;

const MODULE_ID = process.cwd();

// Check if the source directory exists
if (!existsSync(SRC_PATH)) {
  console.error(`Error: Source directory "${SRC_PATH}" does not exist.`);
  process.exit(1);
}

const packs = await fs.readdir(SRC_PATH);

// Filter out non-directories and hidden files
const packFolders = (
  await Promise.all(
    packs.map(async (p) => {
      const stat = await fs.stat(`${SRC_PATH}/${p}`);
      return stat.isDirectory() ? p : null;
    }),
  )
).filter((p) => p !== null);

if (!packFolders.length) {
  console.warn(
    `Warning: No source folders found in "${SRC_PATH}". Skipping compilation.`,
  );
} else {
  for (const pack of packFolders) {
    console.log("Packing " + pack);
    try {
      await compilePack(
        `${MODULE_ID}/packs-src/${pack}`,
        `${MODULE_ID}/packs/${pack}`,
        { yaml, recursive: folders },
      );
    } catch (err) {
      console.error(`Failed to pack "${pack}":`, err);
    }
  }
}
