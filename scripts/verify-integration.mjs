import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");

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

const allFiles = (await walk(sourceRoot)).filter((file) => /\.(ts|tsx)$/.test(file));
const contents = new Map(await Promise.all(allFiles.map(async (file) => [file, await fs.readFile(file, "utf8")])));
const relative = (file) => path.relative(root, file).replaceAll(path.sep, "/");
const failures = [];

const uiFiles = allFiles.filter((file) => {
  const name = relative(file);
  return name.startsWith("src/components/") || /src\/app\/.*\/(page|layout)\.tsx$/.test(name);
});
for (const file of uiFiles) {
  if (contents.get(file).includes('from "@/lib/prisma"') || contents.get(file).includes("from '@/lib/prisma'")) {
    failures.push(`${relative(file)} imports Prisma directly. UI files must call services.`);
  }
}

const actionFiles = allFiles.filter((file) => relative(file).startsWith("src/actions/"));
for (const file of actionFiles) {
  const content = contents.get(file);
  if (!content.includes('"use server"') && !content.includes("'use server'")) {
    failures.push(`${relative(file)} is missing the use server directive.`);
  }
  if (!content.includes("@/services/")) {
    failures.push(`${relative(file)} does not delegate business logic to a service.`);
  }
  const alias = `@/${relative(file).replace(/^src\//, "").replace(/\.ts$/, "")}`;
  if (![...contents.values()].some((candidate) => candidate.includes(alias))) {
    failures.push(`${relative(file)} is not imported by any page, component, route, or supporting module.`);
  }
}

const serviceFiles = allFiles.filter((file) => relative(file).startsWith("src/services/"));
for (const file of serviceFiles) {
  const alias = `@/${relative(file).replace(/^src\//, "").replace(/\.ts$/, "")}`;
  if (![...contents.entries()].some(([candidateFile, candidate]) => candidateFile !== file && candidate.includes(alias))) {
    failures.push(`${relative(file)} is not imported anywhere.`);
  }
}

if (failures.length) {
  console.error("Integration verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Integration verification passed: ${actionFiles.length} action files, ${serviceFiles.length} service files, and ${uiFiles.length} UI route/component files checked.`);
