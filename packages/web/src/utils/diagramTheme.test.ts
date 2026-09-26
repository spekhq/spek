import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DIAGRAM_COLORS,
  DECLARED_DEFAULTS,
  cssVarOf,
  resolveDiagramColors,
} from "./diagramTheme";

const SOURCE = readFileSync(fileURLToPath(new URL("./diagramTheme.ts", import.meta.url)), "utf8");

// The rule `ui-package` states for a package with no theme, applied here for a different reason: this
// table's values never pass through a stylesheet, so a literal in it is invisible to every check that
// reads `global.css`. There is no exemption list, because no colour here renders nothing or is the
// absence of light — every entry is a mark a reader looks at.
test("the palette contains no colour literal", () => {
  const literals = SOURCE.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g) ?? [];
  assert.deepEqual(literals, [], `use a --color-* token instead: ${literals.join(", ")}`);
});

test("every entry declares a role, and a surface says why it owes nothing", () => {
  for (const [mermaidVar, entry] of Object.entries(DIAGRAM_COLORS)) {
    assert.ok(entry.token, `${mermaidVar} names no token`);
    assert.ok(entry.label, `${mermaidVar} has no label saying where it reaches the reader`);
    assert.ok(
      ["text", "graphic", "surface", "textOn"].includes(entry.role.kind),
      `${mermaidVar} has no role`,
    );
    if (entry.role.kind === "surface") {
      assert.ok(entry.role.reason, `${mermaidVar} is declared a surface but states no reason`);
    }
    if (entry.role.kind === "textOn") {
      // The fill it sits on must be a token this palette actually draws with, or the measurement in
      // contrast.test.ts is against a colour that appears nowhere in the diagram.
      const fill = entry.role.on;
      assert.ok(
        Object.values(DIAGRAM_COLORS).some((c) => c.token === fill),
        `${mermaidVar} is measured on --color-${fill}, which no entry in this table draws`,
      );
    }
  }
});

// A variable in both places is a variable whose declaration contradicts itself: the table says the app
// supplies it, and the default list says the app leaves it to Mermaid.
test("a variable is declared once, not both set and left to Mermaid", () => {
  const both = Object.keys(DIAGRAM_COLORS).filter((k) => k in DECLARED_DEFAULTS);
  assert.deepEqual(both, [], `declared twice: ${both.join(", ")}`);
});

test("every declared default states why it owes nothing", () => {
  for (const [name, reason] of Object.entries(DECLARED_DEFAULTS)) {
    assert.ok(reason.length > 10, `${name} is left to Mermaid with no stated reason`);
  }
});

test("resolveDiagramColors maps every variable through its token", () => {
  const resolved = resolveDiagramColors((cssVar) => `<${cssVar}>`);
  assert.deepEqual(Object.keys(resolved).sort(), Object.keys(DIAGRAM_COLORS).sort());
  assert.equal(resolved.textColor, `<${cssVarOf(DIAGRAM_COLORS.textColor.token)}>`);
  assert.equal(resolved.lineColor, `<${cssVarOf(DIAGRAM_COLORS.lineColor.token)}>`);
});

// Dropping beats substituting: Mermaid's base default for one key is a worse answer than a literal
// nobody measured, but a literal is the one thing this table may not contain.
test("a token that resolves empty is dropped rather than given a literal", () => {
  const resolved = resolveDiagramColors((cssVar) =>
    cssVar === cssVarOf(DIAGRAM_COLORS.lineColor.token) ? "   " : "#000",
  );
  assert.equal("lineColor" in resolved, false);
  assert.ok(Object.keys(resolved).length > 0);
});

test("whitespace around a resolved value is trimmed", () => {
  // getComputedStyle returns a leading space for a custom property declared as `--x: #fff`.
  const resolved = resolveDiagramColors(() => "  #123456  ");
  assert.equal(resolved.textColor, "#123456");
});

// --- No silent defaults ------------------------------------------------------
//
// The rule this file states ("every base variable is either set or declared") was not enforced until
// review pointed that out: the checks above only looked at keys already present in one of the two
// lists, so a variable in neither was invisible to them. Mermaid's base theme hard-codes
// `doneTaskBkgColor: "lightgrey"`, `critBkgColor: "red"` and `altSectionBkgColor: "white"`, which is
// how a dark gantt drew light text at about 1.1:1 while this file reported a complete palette.
//
// The enumeration is taken from Mermaid itself rather than hand-written, so it cannot go stale on an
// upgrade. "Did our palette reach this variable?" is answered by resolving the theme twice with
// different inputs: anything that does not move is not derived from what we supply, so it is a
// hard-coded default and has to be accounted for.

async function resolveTwice(): Promise<{ a: Record<string, unknown>; b: Record<string, unknown> }> {
  const { default: mermaid } = await import("mermaid");
  const keys = Object.keys(DIAGRAM_COLORS);
  const resolve = (fill: string) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        ...Object.fromEntries(keys.map((k) => [k, fill])),
        fontFamily: "x",
        darkMode: false,
      },
    });
    return mermaid.mermaidAPI.getConfig().themeVariables as unknown as Record<string, unknown>;
  };
  return { a: resolve("#101010"), b: resolve("#f0f0f0") };
}

const looksLikeColour = (v: unknown): boolean =>
  typeof v === "string" &&
  /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|[a-z]+)$/i.test(v) &&
  !/^(calculated|undefined|null|true|false|normal|bold|lighter|\d)/i.test(v);

test("every colour Mermaid resolves is either set by us or declared as a default", async () => {
  const { a, b } = await resolveTwice();
  const unaccounted = Object.keys(a).filter(
    (k) =>
      looksLikeColour(a[k]) &&
      a[k] === b[k] && // unmoved by our palette, so it is Mermaid's own literal
      !(k in DIAGRAM_COLORS) &&
      !(k in DECLARED_DEFAULTS),
  );
  assert.deepEqual(
    unaccounted,
    [],
    "these Mermaid colours are neither set from a token nor declared in DECLARED_DEFAULTS with a " +
      `reason:\n${unaccounted.map((k) => `  ${k} = ${String(a[k])}`).join("\n")}`,
  );
});

test("the variables we set actually reach Mermaid", async () => {
  // The other direction: a key we declare but Mermaid does not recognise is dead weight that reads as
  // covering something. It would also hide a rename on a Mermaid upgrade.
  const { a } = await resolveTwice();
  const unknown = Object.keys(DIAGRAM_COLORS).filter((k) => !(k in a));
  assert.deepEqual(unknown, [], `not Mermaid theme variables: ${unknown.join(", ")}`);
});
