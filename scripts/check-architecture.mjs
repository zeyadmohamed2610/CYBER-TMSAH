import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const slash = (file) => file.replaceAll("\\", "/");
const config = ts.readConfigFile("tsconfig.app.json", ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
const files = (await fs.readdir("src", { recursive: true }))
  .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"))
  .map((file) => path.resolve("src", file));
const isTest = (file) => /\/(__tests__|test)\/|\.(test|spec)\./.test(slash(file));
const moduleGraph = new Map();
const runtimeGraph = new Map();
const errors = [];

function checkBoundary(file, target) {
  const from = slash(path.relative(root, file));
  const to = slash(path.relative(root, target));
  if (from.startsWith("src/shared/") && !to.startsWith("src/shared/")) {
    errors.push(`${from}: shared code cannot depend on ${to}`);
  }
  const feature = from.match(/^src\/features\/([^/]+)\//)?.[1];
  const other = to.match(/^src\/features\/([^/]+)\//)?.[1];
  const allowed = {
    auth: ["auth", "academics"],
    academics: ["academics", "auth"],
    schedule: ["schedule", "auth", "academics"],
    accounts: ["accounts", "auth", "academics"],
  };
  if (feature && other && allowed[feature] && !allowed[feature].includes(other)) {
    errors.push(`${from}: ${feature} cannot depend on ${other} (${to})`);
  }
}

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    await fs.readFile(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const dependencies = [];
  const runtime = [];
  function record(specifier, typeOnly = false) {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return;
    if (/\.(css|svg|png|webp)$/.test(specifier)) return;
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    if (!resolved) {
      errors.push(`${slash(path.relative(root, file))}: unresolved ${specifier}`);
      return;
    }
    const target = path.resolve(resolved.resolvedFileName);
    if (!target.startsWith(path.resolve("src") + path.sep)) return;
    dependencies.push(target);
    if (!typeOnly) runtime.push(target);
    if (!isTest(file)) checkBoundary(file, target);
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const bindings = node.importClause?.namedBindings;
      const typeOnly =
        node.isTypeOnly ||
        node.importClause?.isTypeOnly ||
        (bindings &&
          ts.isNamedImports(bindings) &&
          !node.importClause.name &&
          bindings.elements.every((item) => item.isTypeOnly));
      record(node.moduleSpecifier.text, Boolean(typeOnly));
    } else if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const name = node.expression.getText(source);
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        name === "vi.mock" ||
        name === "vi.doMock"
      )
        record(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!isTest(file)) {
    moduleGraph.set(file, dependencies);
    runtimeGraph.set(file, runtime);
  }
}

const reachable = new Set();
function mark(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  (moduleGraph.get(file) ?? []).forEach(mark);
}
// siteMetadata is also consumed by the build-time SEO generator.
["src/main.tsx", "src/shared/lib/siteMetadata.ts"].forEach((file) => mark(path.resolve(file)));
for (const file of moduleGraph.keys()) {
  if (!reachable.has(file))
    errors.push(`Unused application module: ${slash(path.relative(root, file))}`);
}

const completed = new Set();
const active = new Set();
function checkCycles(file, chain = []) {
  if (active.has(file)) {
    errors.push(
      `Runtime import cycle: ${[...chain.slice(chain.indexOf(file)), file].map((item) => slash(path.relative(root, item))).join(" -> ")}`,
    );
    return;
  }
  if (completed.has(file)) return;
  active.add(file);
  (runtimeGraph.get(file) ?? []).forEach((target) => checkCycles(target, [...chain, file]));
  active.delete(file);
  completed.add(file);
}
for (const file of runtimeGraph.keys()) checkCycles(file);
if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Architecture passed: ${moduleGraph.size} application modules; no unreachable modules, runtime cycles, broken imports, or forbidden dependencies.`,
  );
}
