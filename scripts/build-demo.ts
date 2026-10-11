import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanOpenSpec,
  readSpec,
  readChange,
  readSpecAtChange,
  buildGraphData,
  listSchemas,
  readSchema,
  groupSchemaUsage,
  shortenSchemaPath,
} from "../packages/core/dist/index.js";
import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  ChangesData,
  ChangeDetail,
  SchemaDefinition,
} from "../packages/core/dist/index.js";
import { assembleDemoHtml, findAbsolutePaths } from "./demo-html.js";
import { buildFontFaceCss } from "./demo-fonts.js";
import { readFontSources } from "./demo-font-sources.js";
import { formatNotices, shippedPackages, type ShippedPackage } from "./demo-notices.js";
import { readPackageNotice } from "./demo-notice-sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "packages", "web");
const DIST_DEMO = path.join(WEB_DIR, "dist-demo");

// CLI 參數解析
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const REPO_DIR = getArg("--repo-dir") ? path.resolve(getArg("--repo-dir")!) : ROOT;
const OUT_FILE = getArg("--output") ? path.resolve(getArg("--output")!) : path.join(ROOT, "docs", "demo.html");
const PAGE_TITLE = getArg("--title") || "spek — OpenSpec Viewer Demo";

/**
 * The schemas the demo may publish: `package` plus this repo's committed ones, i.e. what a clean
 * checkout has. `listSchemas` otherwise returns whatever is on the build machine, and `docs/` is
 * uploaded verbatim — so without this the published payload depends on who ran the build.
 */
function filterPublishableSchemas<T extends { name: string; source: string }>(schemas: T[]): T[] {
  const tracked = trackedProjectSchemas();
  const kept: T[] = [];
  for (const s of schemas) {
    if (s.source === "user") {
      console.log(`  skipping machine-local schema "${s.name}" (source: user)`);
      continue;
    }
    if (s.source === "project" && !tracked.has(s.name)) {
      console.log(`  skipping untracked project schema "${s.name}" (not committed)`);
      continue;
    }
    kept.push(s);
  }
  return kept;
}

/**
 * Strip the builder's filesystem out of a definition. `path` is absolute — for a package schema,
 * wherever npm installed the CLI — and reaches the payload quietly, as a `title` rather than
 * visible text. `displayPath` says the same thing without the machine.
 */
function deLocalise(schema: SchemaDefinition): SchemaDefinition {
  return {
    ...schema,
    path: schema.displayPath,
    shadows: schema.shadows.map((s) => ({ ...s, path: shortenSchemaPath(s.path, { repoRoot: REPO_DIR }) })),
  };
}

/** Project schema names that git actually tracks, by directory under `openspec/schemas/`. */
function trackedProjectSchemas(): Set<string> {
  let out: string;
  try {
    out = execSync("git ls-files -- openspec/schemas", {
      cwd: REPO_DIR,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // No git, so nothing can be verified as committed — publish no project schemas at all.
    return new Set();
  }
  const names = new Set<string>();
  for (const line of out.split("\n")) {
    const match = /^openspec\/schemas\/([^/]+)\//.exec(line.trim());
    if (match) names.add(match[1]);
  }
  return names;
}

async function main() {
  // 1. 收集 openspec 資料
  console.log("Collecting openspec data...");

  const scan = await scanOpenSpec(REPO_DIR);

  const overview: OverviewData = {
    specsCount: scan.specs.length,
    changesCount: {
      active: scan.activeChanges.length,
      archived: scan.archivedChanges.length,
    },
    taskStats: {
      total: 0,
      completed: 0,
    },
  };

  // 彙總 task stats
  for (const c of [...scan.activeChanges, ...scan.archivedChanges]) {
    if (c.taskStats) {
      overview.taskStats.total += c.taskStats.total;
      overview.taskStats.completed += c.taskStats.completed;
    }
  }

  // 讀取所有 spec details
  const specDetails: Record<string, SpecDetail> = {};
  for (const spec of scan.specs) {
    const detail = await readSpec(REPO_DIR, spec.topic);
    if (detail) {
      specDetails[spec.topic] = detail;
    }
  }

  // 讀取所有 change details
  const changeDetails: Record<string, ChangeDetail> = {};
  const allChanges = [...scan.activeChanges, ...scan.archivedChanges];
  for (const change of allChanges) {
    const detail = await readChange(REPO_DIR, change.slug);
    if (detail) {
      changeDetails[change.slug] = detail;
    }
  }

  // The scanner's path is absolute — right on the reader's machine, the builder's home directory in a
  // published page. The record carries it relative to the repository, as a clean checkout has it.
  const specs: SpecInfo[] = scan.specs.map((spec) => ({
    ...spec,
    path: path.relative(REPO_DIR, spec.path).split(path.sep).join("/"),
  }));
  const changes: ChangesData = {
    active: scan.activeChanges,
    archived: scan.archivedChanges,
    defaultSchema: scan.defaultSchema,
  };

  // 收集 spec 歷史版本內容（供 diff 檢視）
  const specVersions: Record<string, Record<string, string>> = {};
  for (const spec of scan.specs) {
    const detail = specDetails[spec.topic];
    if (!detail?.history?.length) continue;
    for (const entry of detail.history) {
      const version = readSpecAtChange(REPO_DIR, spec.topic, entry.slug);
      if (version) {
        if (!specVersions[spec.topic]) specVersions[spec.topic] = {};
        specVersions[spec.topic][entry.slug] = version.content;
      }
    }
  }

  // 建立 graph 資料
  const graphData = buildGraphData(REPO_DIR);

  // Workflow schemas, captured here so the demo needs neither the openspec CLI nor a filesystem at
  // view time — the whole point of the static build. The catalog is joined with change usage exactly
  // as the server routes do, and every enumerated schema's definition is read so the detail page
  // works offline; a schema that cannot be read is left out rather than embedded half-formed, and
  // the view's own not-found state covers it.
  const catalog = await listSchemas(REPO_DIR);
  const publishable = filterPublishableSchemas(catalog.schemas);
  const schemas = groupSchemaUsage({ ...catalog, schemas: publishable }, scan.activeChanges);
  const schemaDetails: Record<string, SchemaDefinition> = {};
  for (const summary of publishable) {
    const result = await readSchema(REPO_DIR, summary.name);
    if (result.ok) schemaDetails[summary.name] = deLocalise(result.schema);
  }

  const demoData = {
    overview,
    specs,
    specDetails,
    changes,
    changeDetails,
    specVersions,
    graphData,
    schemas,
    schemaDetails,
  };

  console.log(
    `  ${specs.length} specs, ${changes.active.length} active + ${changes.archived.length} archived changes`,
  );
  console.log(
    `  ${schemas.schemas.length} schemas (${Object.keys(schemaDetails).length} readable)` +
      (catalog.degradedReason ? `, degraded: ${catalog.degradedReason}` : ""),
  );

  const absolute = findAbsolutePaths(demoData);
  if (absolute.length > 0) {
    throw new Error(
      `the payload would publish the build machine's filesystem: ${absolute.join(", ")} ` +
        "hold an absolute path (demo-page: embedded records carry their source-relative form)",
    );
  }

  const fonts = buildFontFaceCss(readFontSources());

  // dist-demo/ is not gitignored, so it is removed in `finally`: a build that fails — at Vite or at
  // the structural check below — must not leave untracked output behind.
  try {
    // 2. 執行 Vite build
    console.log("Building demo with Vite...");
    execSync("npx vite build --config vite.demo.config.ts", {
      cwd: WEB_DIR,
      stdio: "inherit",
    });

    // 3. 讀取 build 產出，組裝成單檔 HTML
    console.log("Assembling single-file HTML...");

    const distFiles = fs.readdirSync(path.join(DIST_DEMO, "assets"));
    const jsFile = distFiles.find((f) => f.endsWith(".js"));
    const cssFile = distFiles.find((f) => f.endsWith(".css"));

    if (!jsFile) throw new Error("No JS output found");

    const jsContent = fs.readFileSync(path.join(DIST_DEMO, "assets", jsFile), "utf-8");
    const cssContent = cssFile
      ? fs.readFileSync(path.join(DIST_DEMO, "assets", cssFile), "utf-8")
      : "";

    // The packages whose code the bundle contains (recorded by vite.demo.config.ts), plus two the
    // module graph does not show: Tailwind, whose generated CSS carries its preflight, and the font.
    const shippedIds: string[] = JSON.parse(
      fs.readFileSync(path.join(DIST_DEMO, "assets", "shipped-modules.json"), "utf-8"),
    );
    const named: ShippedPackage[] = [{ name: "@fontsource-variable/plus-jakarta-sans", root: null }];
    if (/tailwindcss v\d/.test(jsContent + cssContent)) named.push({ name: "tailwindcss", root: null });
    const notices = formatNotices(
      [...shippedPackages(shippedIds), ...named].map((pkg) => readPackageNotice(pkg, WEB_DIR)),
    );

    // Throws, naming the part, if the page would not parse back as written (#54) — so nothing is
    // written and the build exits non-zero instead of reporting success for a page that cannot boot.
    const html = assembleDemoHtml({
      title: PAGE_TITLE,
      payload: demoData,
      fonts,
      notices,
      script: jsContent,
      stylesheet: cssContent,
    });

    // 4. 寫入最終檔案
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, html, "utf-8");

    const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(1);
    console.log(`\n✓ Demo built: ${OUT_FILE} (${sizeKB} KB)`);
  } finally {
    // 5. 清理暫存
    fs.rmSync(DIST_DEMO, { recursive: true, force: true });
    console.log("✓ Cleaned up dist-demo/");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
