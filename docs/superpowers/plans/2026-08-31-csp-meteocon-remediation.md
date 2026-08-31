# CSP-Safe Meteocon Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Meteocon inline SVG style violations from source, build, and packaged output while preserving icon appearance and production `style-src 'self'`.

**Architecture:** Replace runtime `<style>` injection with a pure allowlisted presentation-attribute transformer owned by the Meteocon component module. Extend the existing CSP tests and packaged smoke diagnostics so both raw icon output and built bundles fail if inline SVG style markup returns.

**Tech Stack:** React 19, raw SVG Vite imports, TypeScript, Vitest/JSDOM, Electron production CSP, Vite build output.

**Spec:** `docs/superpowers/specs/2026-08-31-unified-theme-ci-csp-electron-replicate-design.md`

## Global Constraints

- `rendererCsp(false)` must continue returning production `style-src 'self'` without `'unsafe-inline'`.
- Do not add a general-purpose HTML or SVG sanitizer dependency.
- Do not allow event handlers, URL-valued properties, arbitrary CSS, external resource references, or dangerous elements.
- Preserve the existing no-JSX-inline-style verifier contract.
- Keep Meteocon rendering through the current narrow component boundary.

---

### Task 1: Reproduce and characterize the violating SVG output

**Files:**
- Read: `src/components/ui/Meteocon.tsx`
- Read: `node_modules/@meteocons/svg/fill/*.svg`
- Read: `electron/utils/rendererCsp.ts`
- Read: `electron/utils/rendererCsp.test.ts`
- Read: `tests/csp/inlineStyleInvariant.test.ts`

**Interfaces:**
- Consumes: the bundled raw icon strings and current light-mode override table.
- Produces: exact affected icons, element selectors, and supported presentation properties.

- [ ] **Step 1: Enumerate raw inline styles and generated style blocks**

```bash
rg -n '<style|style=' node_modules/@meteocons/svg/fill src/components/ui/Meteocon.tsx
```

- [ ] **Step 2: Build the current renderer and locate emitted violations**

```bash
npm run build
rg -n '<style|style=' dist --glob '*.js' --glob '*.html' --glob '*.svg'
```

Record only Meteocon-related matches as CSP-001 evidence; classify unrelated matches separately rather than broadening the fix.

### Task 2: Replace `<style>` injection with an allowlisted transformer

**Files:**
- Modify: `src/components/ui/Meteocon.tsx`
- Create: `src/components/ui/Meteocon.test.tsx`

**Interfaces:**
- Consumes: `rawSvg`, `MeteoconName`, and effective `light | dark` mode.
- Produces: exported-for-test `adaptSvgForTheme(rawSvg, name, mode): string` with no `<style>` or `style=` output.

- [ ] **Step 1: Write failing tests for a known light-mode override**

```ts
it("converts supported light-mode presentation overrides to attributes", () => {
  const source = '<svg><path id="Wind" stroke="#E2E8F0" /></svg>';
  const result = adaptSvgForTheme(source, "wind", "light");
  expect(result).toContain('id="Wind"');
  expect(result).toContain('stroke="#64748B"');
  expect(result).not.toMatch(/<style\b|\sstyle=/i);
});

it("does not add unsupported properties or event handlers", () => {
  const source = '<svg><path id="Wind" stroke="#E2E8F0" /></svg>';
  const result = applySvgPresentationOverrides(source, {
    "#Wind": { stroke: "#64748B", onclick: "alert(1)", fill: "url(https://evil.test/x)" },
  });
  expect(result).toContain('stroke="#64748B"');
  expect(result).not.toContain("onclick");
  expect(result).not.toContain("evil.test");
});
```

- [ ] **Step 2: Run the tests and confirm failure**

```bash
npx vitest run src/components/ui/Meteocon.test.tsx --no-file-parallelism
```

Expected: fail because the transformer is not exported and the current output injects `<style>`.

- [ ] **Step 3: Replace CSS strings with typed presentation overrides**

```ts
type SvgPresentationProperty = "fill" | "stroke" | "stroke-width" | "opacity";
type SvgPresentationOverrides = Readonly<Record<string, Readonly<Partial<Record<SvgPresentationProperty, string>>>>>;

const LIGHT_MODE_OVERRIDES: Partial<Record<MeteoconName, SvgPresentationOverrides>> = {
  wind: {
    "#Wind": { stroke: "#64748B" },
    '[id^="Wind Line"]': { stroke: "#64748B" },
  },
  snowflake: { "#Snowflake_2": { stroke: "#0EA5E9" } },
  star: { "#Star_2": { stroke: "#D97706" } },
  tornado: { '[id^="Tornado"]': { stroke: "#64748B" } },
  umbrella: { "#Vector_2": { stroke: "#94A3B8" } },
};
```

Represent every existing cloud, lightning, exclamation, code-alert, wind, snowflake, star, tornado, and umbrella override in this table.

- [ ] **Step 4: Implement DOM-based allowlisted attribute application**

```ts
const SAFE_SVG_VALUE = /^(?:#[0-9a-fA-F]{3,8}|none|currentColor|\d+(?:\.\d+)?)$/;

export function applySvgPresentationOverrides(
  rawSvg: string,
  overrides: SvgPresentationOverrides,
): string {
  const doc = new DOMParser().parseFromString(rawSvg, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || root.querySelector("parsererror")) return rawSvg;

  root.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((element) => element.remove());
  root.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      if ((attribute.name === "href" || attribute.name === "xlink:href") && !attribute.value.startsWith("#")) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  for (const [selector, properties] of Object.entries(overrides)) {
    for (const element of root.querySelectorAll(selector)) {
      for (const [property, value] of Object.entries(properties)) {
        if (!SAFE_SVG_VALUE.test(value)) continue;
        element.setAttribute(property, value);
      }
    }
  }
  root.querySelectorAll("style").forEach((element) => element.remove());
  root.querySelectorAll("[style]").forEach((element) => element.removeAttribute("style"));
  return new XMLSerializer().serializeToString(root);
}

export function adaptSvgForTheme(
  rawSvg: string,
  name: MeteoconName,
  mode: "dark" | "light",
): string {
  const overrides = mode === "light" ? LIGHT_MODE_OVERRIDES[name] : undefined;
  return applySvgPresentationOverrides(rawSvg, overrides ?? {});
}
```

The transformer strips source `<style>` and `style=` markup in both modes; only the allowlisted theme overrides are added.

- [ ] **Step 5: Add structural security tests**

Cover `<script>`, `onload`, external `href`, `javascript:` and `url(...)` inputs. Assert the transformation never introduces them and does not convert unsupported CSS properties into attributes. If the bundled raw source already contains one, fail closed by removing it before serialization.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run src/components/ui/Meteocon.test.tsx --no-file-parallelism
```

- [ ] **Step 7: Commit the component boundary**

```bash
git add src/components/ui/Meteocon.tsx src/components/ui/Meteocon.test.tsx
git diff --cached --check
git commit -m "fix: render Meteocon SVGs without inline styles"
```

### Task 3: Extend canonical CSP source and build verification

**Files:**
- Modify: `tests/csp/inlineStyleInvariant.test.ts`
- Create: `scripts/verify-meteocon-csp.cjs`
- Create: `scripts/verify-meteocon-csp.test.ts`
- Modify: `package.json`
- Modify: the existing `verify:contracts:static` composition in `package.json`.

**Interfaces:**
- Consumes: Meteocon source and built `dist` assets.
- Produces: `verify:meteocon-csp` failing on `<style>` or `style=` in known raw/generated Meteocon content.

- [ ] **Step 1: Write failing verifier tests**

```ts
it("rejects generated Meteocon inline style markup", () => {
  expect(scanMeteoconMarkup('<svg><style>#Wind{stroke:red}</style></svg>')).toEqual(
    expect.arrayContaining([expect.stringMatching(/style element/i)]),
  );
  expect(scanMeteoconMarkup('<svg><path style="stroke:red" /></svg>')).toEqual(
    expect.arrayContaining([expect.stringMatching(/style attribute/i)]),
  );
});

it("accepts presentation attributes", () => {
  expect(scanMeteoconMarkup('<svg><path stroke="#64748B" /></svg>')).toEqual([]);
});
```

- [ ] **Step 2: Implement and export the scanner**

The verifier reads `src/components/ui/Meteocon.tsx`, enumerates imported Meteocon SVGs, and scans raw source plus existing `dist` JavaScript/SVG output when `dist` exists. It reports file-relative paths and the prohibited construct without printing full SVG payloads.

- [ ] **Step 3: Register the verifier**

```json
"verify:meteocon-csp": "node scripts/verify-meteocon-csp.cjs"
```

Append `npm run verify:meteocon-csp` to the existing `verify:contracts:static` chain.

- [ ] **Step 4: Correct stale CSP comments**

Update `tests/csp/inlineStyleInvariant.test.ts` and `electron/utils/rendererCsp.ts` comments to say that production renderer code, including bundled raw SVG output, must avoid inline style markup. Do not claim the source-only test scans packaged output; identify the new verifier as that owner.

- [ ] **Step 5: Run verifier tests and build scan**

```bash
npx vitest run scripts/verify-meteocon-csp.test.ts tests/csp/inlineStyleInvariant.test.ts electron/utils/rendererCsp.test.ts --no-file-parallelism
npm run build
npm run verify:meteocon-csp
```

- [ ] **Step 6: Commit the CSP regression gate**

```bash
git add tests/csp/inlineStyleInvariant.test.ts electron/utils/rendererCsp.ts scripts/verify-meteocon-csp.cjs scripts/verify-meteocon-csp.test.ts package.json
git commit -m "test: verify Meteocon CSP compatibility"
```

### Task 4: Strengthen packaged smoke CSP evidence

**Files:**
- Modify: `tests/smoke/electron-smoke.test.ts`

**Interfaces:**
- Consumes: packaged Electron console messages and `securitypolicyviolation` events.
- Produces: a smoke assertion that fails on renderer style-src violations attributable to Meteocon.

- [ ] **Step 1: Add a failing CSP diagnostic assertion**

Collect console and renderer violation messages during first-run and restored-profile smoke paths. Normalize them to strings and assert:

```ts
expect(cspViolations.filter((message) => /style-src|refused to apply inline style/i.test(message))).toEqual([]);
```

- [ ] **Step 2: Run the packaged smoke test against an existing artifact**

```bash
RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts --no-file-parallelism
```

Expected before rebuilding: reproduce the violation if the existing artifact contains the old bundle.

- [ ] **Step 3: Rebuild and rerun smoke**

```bash
npm run dist:mac:arm64
RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts --no-file-parallelism
```

Expected: smoke passes and no production style-src violation is captured.

- [ ] **Step 4: Commit packaged regression coverage**

```bash
git add tests/smoke/electron-smoke.test.ts
git commit -m "test: fail packaged smoke on CSP style violations"
```
