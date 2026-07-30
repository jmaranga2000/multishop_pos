import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const modelRoot = path.join(sourceRoot, "models");

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const sourceFiles = (await walk(sourceRoot)).filter((file) => /\.(ts|tsx)$/.test(file));
const modelFiles = sourceFiles.filter((file) => file.endsWith(".model.ts"));
const serviceFiles = sourceFiles.filter((file) =>
  file.includes(`${path.sep}services${path.sep}`)
  || file.includes(`${path.sep}lib${path.sep}`)
);

const usedModels = new Set();
for (const file of serviceFiles) {
  const contents = await fs.readFile(file, "utf8");
  for (const match of contents.matchAll(/\b(?:db|tx)\.([a-z][A-Za-z0-9]*)\./g)) {
    usedModels.add(match[1]);
  }
}

const declaredModels = new Set();
const documentTypes = new Set();
for (const file of modelFiles) {
  const contents = await fs.readFile(file, "utf8");
  for (const match of contents.matchAll(/defineModel<([A-Za-z][A-Za-z0-9]*Document)>/g)) {
    documentTypes.add(match[1]);
  }
  for (const match of contents.matchAll(/^\s{2}([a-z][A-Za-z0-9]*):\s*[A-Za-z][A-Za-z0-9]*Model,/gm)) {
    declaredModels.add(match[1]);
  }
}

const typeContents = await fs.readFile(path.join(modelRoot, "model.types.ts"), "utf8");
const missingModels = [...usedModels].filter((name) => !declaredModels.has(name));
const missingTypes = [...documentTypes].filter(
  (name) => !typeContents.includes(`interface ${name} `),
);

if (missingModels.length || missingTypes.length) {
  if (missingModels.length) {
    console.error(`Missing native MongoDB models: ${missingModels.sort().join(", ")}`);
  }
  if (missingTypes.length) {
    console.error(`Missing MongoDB document types: ${missingTypes.sort().join(", ")}`);
  }
  process.exit(1);
}

console.log(
  `MongoDB model verification passed: ${declaredModels.size} models, `
  + `${documentTypes.size} document types, ${usedModels.size} service-used models.`,
);
