// Writes the source note into the exported pages as the first thing in the
// file, above <html>. JSX cannot emit a comment, and a comment inside the body
// sits folded away in the inspector; one at the top of the document is the
// first line of view-source and of the Elements tree. Runs after every build.
//
//   node scripts/sign-export.mjs [out]
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SOURCE_COMMENT } from "../lib/source-note.mjs";

const dir = process.argv[2] ?? "out";
const DOCTYPE = "<!DOCTYPE html>";
let signed = 0;
for (const name of await readdir(dir)) {
  if (!name.endsWith(".html")) continue;
  const path = join(dir, name);
  const html = await readFile(path, "utf8");
  if (html.includes(SOURCE_COMMENT)) continue;
  if (!html.startsWith(DOCTYPE)) throw new Error(`${path} does not start with ${DOCTYPE}`);
  await writeFile(path, `${DOCTYPE}\n${SOURCE_COMMENT}\n${html.slice(DOCTYPE.length)}`);
  signed += 1;
}
console.log(`${dir}: source note written to ${signed} page${signed === 1 ? "" : "s"}`);
