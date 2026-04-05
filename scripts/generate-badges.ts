import fs from "node:fs";
import path from "node:path";
import { scanOpenSpec } from "../packages/core/dist/index.js";

// CLI 參數解析
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const REPO_DIR = path.resolve(getArg("--repo-dir") || ".");
const OUTPUT_DIR = path.resolve(getArg("--output-dir") || "badges");

// shields.io flat style SVG 模板
function makeBadge(label: string, value: string, color: string): string {
  const labelWidth = label.length * 6.5 + 12;
  const valueWidth = value.length * 6.5 + 12;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

async function main() {
  console.log(`Scanning OpenSpec data from: ${REPO_DIR}`);
  const scan = await scanOpenSpec(REPO_DIR);

  const specsCount = scan.specs.length;
  const openChanges = scan.activeChanges.length;

  let totalTasks = 0;
  let completedTasks = 0;
  for (const change of scan.activeChanges) {
    if (change.taskStats) {
      totalTasks += change.taskStats.total;
      completedTasks += change.taskStats.completed;
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const badges = [
    { file: "specs.svg", label: "specs", value: `${specsCount}`, color: "#4c1" },
    { file: "open_changes.svg", label: "open changes", value: `${openChanges}`, color: "#007ec6" },
    { file: "tasks.svg", label: "tasks", value: `${completedTasks} / ${totalTasks}`, color: "#f59e0b" },
  ];

  for (const badge of badges) {
    const svg = makeBadge(badge.label, badge.value, badge.color);
    const filePath = path.join(OUTPUT_DIR, badge.file);
    fs.writeFileSync(filePath, svg);
    console.log(`  ✓ ${badge.file}`);
  }

  console.log(`\n✓ Badges generated in: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Badge generation failed:", err);
  process.exit(1);
});
