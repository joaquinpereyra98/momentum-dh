import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs, existsSync } from "fs";
import path from "path";

const MODULE_ID = process.cwd();
const yaml = false;
const expandAdventures = true;
const folders = true;
const PACKS_DIR = "./packs";
const SRC_DIR = "./packs-src";

// Check if the packs directory exists
if (!existsSync(PACKS_DIR)) {
  console.error(`Error: Source directory "${PACKS_DIR}" not found.`);
  process.exit(1);
}

const packs = await fs.readdir(PACKS_DIR);

//Filter for DB files
const validPacks = packs.filter(p => !p.startsWith('.') && p !== "README.md");

if (validPacks.length === 0) {
  console.warn("No packs found to unpack. Skipping process.");
} else {
  for (const pack of validPacks) {
    console.log("Unpacking " + pack);
    const destDirectory = `${SRC_DIR}/${pack}`;

    try {
      // Ensure the dest directory exists
      if (!existsSync(destDirectory)) {
        await fs.mkdir(destDirectory, { recursive: true });
      } else {
        // Clean existing files
        const files = await fs.readdir(destDirectory);
        for (const file of files) {
          const filePath = path.join(destDirectory, file);
          if (file.endsWith(yaml ? ".yml" : ".json")) {
            await fs.unlink(filePath);
          } else {
            await fs.rm(filePath, { recursive: true, force: true });
          }
        }
      }

      // Extraction
      await extractPack(
        `${MODULE_ID}/packs/${pack}`,
        destDirectory,
        {
          yaml,
          transformName,
          expandAdventures,
          folders,
        }
      );
    } catch (error) {
      console.error(`Failed to process pack "${pack}":`, error.message);
    }
  }
}

/**
 * Prefaces the document with its type
 * @param {object} doc - The document data
 * @param {object} context - The extraction context
 */
function transformName(doc, context) {
  const safeFileName = doc.name ? doc.name.replace(/[^a-zA-Z0-9А-я]/g, "_") : "unnamed";
  let type = doc._key?.split("!")[1];
  
  if (!type) {
    if ("playing" in doc) type = "playlist";
    else if (doc.sorting) type = `folder_${doc.type}`;
    else if (doc.walls) type = "scene";
    else if (doc.results) type = "rollTable";
    else if (doc.pages) type = "journal";
    else type = doc.type;
  }
  
  const prefix = ["actors", "items"].includes(type) ? doc.type : type;
  let name = `${doc.name ? `${prefix}_${safeFileName}_${doc._id}` : doc._id}.${yaml ? "yml" : "json"}`;
  
  if (context.folder) name = path.join(context.folder, name);
  return name;
}