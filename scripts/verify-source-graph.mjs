import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const roots = [path.join(root, "src")];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const files = roots.flatMap(walk).filter((file) => /\.(ts|tsx)$/.test(file));
const modules = new Map();
let failed = false;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  for (const diagnostic of ast.parseDiagnostics) {
    failed = true;
    console.error(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  }

  const exports = new Set();
  let hasDefault = false;
  for (const statement of ast.statements) {
    const modifiers = ts.getCombinedModifierFlags(statement);
    if (modifiers & ts.ModifierFlags.Export) {
      if (modifiers & ts.ModifierFlags.Default) hasDefault = true;
      if (statement.name?.text) exports.add(statement.name.text);
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) exports.add(declaration.name.text);
        }
      }
    }
    if (ts.isExportAssignment(statement)) hasDefault = true;
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) exports.add(element.name.text);
    }
  }
  modules.set(file, { ast, exports, hasDefault });
}

function resolveInternal(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) {
    if (/\.(css|scss|sass|less)$/.test(specifier)) return null;
    base = path.resolve(path.dirname(fromFile), specifier);
  } else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

for (const [file, module] of modules) {
  for (const statement of module.ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const target = resolveInternal(file, specifier);
    if (target === null) continue;
    if (target === undefined) {
      failed = true;
      console.error(`${path.relative(root, file)} imports missing internal module ${specifier}`);
      continue;
    }

    const targetModule = modules.get(target);
    if (!targetModule) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name && !targetModule.hasDefault) {
      failed = true;
      console.error(`${path.relative(root, file)} imports a missing default export from ${specifier}`);
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (!targetModule.exports.has(importedName)) {
          failed = true;
          console.error(`${path.relative(root, file)} imports missing export ${importedName} from ${specifier}`);
        }
      }
    }
  }
}

if (failed) process.exit(1);
console.log(`Source graph verification passed for ${files.length} TypeScript files.`);
