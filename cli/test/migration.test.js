/**
 * Tests for the yarn -> bun migration (todo.md objective 1).
 *
 * These assert the repository state that "migrated" means, so the migration
 * cannot silently regress. Run with: bun test cli/test/migration.test.js
 */
import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Every workspace that had its own yarn.lock before the migration. */
const WORKSPACES = [".", "fbg-server", "web", "v2", "misc/e2e"];

/**
 * Workspaces whose yarn.lock cannot be migrated yet, with the reason.
 *
 * `v2` pins `next@13.5.0`, whose tarball is broken upstream:
 * https://registry.npmjs.org/next/-/next-13.5.0.tgz returns 404 even though
 * the version metadata advertises that exact URL. Its neighbours (13.5.1,
 * 13.4.19, 14.2.5) download fine, so this is a registry defect, not a
 * bun/yarn difference. Bumping the pin would change application behaviour
 * (and 13.5.x is covered by a security advisory), so it needs a deliberate
 * dependency decision rather than a silent version change during a
 * package-manager migration.
 */
const UNMIGRATED_WORKSPACES = new Map([["v2", "next@13.5.0 tarball 404 upstream"]]);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/** Directories that hold local caches/vendored code, never repo sources. */
const SKIP_DIRS = new Set(["node_modules", ".git", ".buncache", ".buntmp", "dist", "build", ".next", "out"]);

/** All package.json files in the repo that are not inside node_modules. */
function findPackageJsons(dir = ROOT, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findPackageJsons(full, acc);
    else if (entry.name === "package.json") acc.push(full);
  }
  return acc;
}

describe("yarn -> bun migration", () => {
  test("no yarn.lock files remain", () => {
    const leftovers = [];
    for (const ws of WORKSPACES) {
      if (UNMIGRATED_WORKSPACES.has(ws)) continue;
      const lock = path.join(ROOT, ws, "yarn.lock");
      if (fs.existsSync(lock)) leftovers.push(path.relative(ROOT, lock));
    }
    expect(leftovers).toEqual([]);
  });

  test("known-unmigrated workspaces are documented and still pending", () => {
    // This keeps the exception honest: if a workspace's yarn.lock disappears
    // (migration finally possible) this test fails so the entry gets removed.
    for (const [ws, reason] of UNMIGRATED_WORKSPACES) {
      expect(reason.length).toBeGreaterThan(0);
      const lock = path.join(ROOT, ws, "yarn.lock");
      if (!fs.existsSync(lock)) {
        throw new Error(
          `${ws}/yarn.lock is gone but is still listed in UNMIGRATED_WORKSPACES ` +
            `("${reason}"). Remove the entry from the map.`
        );
      }
    }
  });

  test("no package.json script invokes yarn", () => {
    const offenders = [];
    for (const pkgPath of findPackageJsons()) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
        if (/\byarn\b/.test(cmd)) {
          offenders.push(`${path.relative(ROOT, pkgPath)}: ${name} -> ${cmd}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no CI workflow invokes yarn", () => {
    const wfDir = path.join(ROOT, ".github", "workflows");
    const offenders = [];
    for (const f of fs.readdirSync(wfDir)) {
      const text = fs.readFileSync(path.join(wfDir, f), "utf8");
      text.split("\n").forEach((line, i) => {
        if (/\byarn\b/.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test("bun lockfile is committed at the root", () => {
    const hasLock =
      fs.existsSync(path.join(ROOT, "bun.lock")) ||
      fs.existsSync(path.join(ROOT, "bun.lockb"));
    expect(hasLock).toBe(true);
  });

  test("CLI error messages tell the user to run bun, not yarn", () => {
    const util = fs.readFileSync(path.join(ROOT, "cli", "util.js"), "utf8");
    expect(util).not.toMatch(/\byarn install\b/);
    expect(util).toMatch(/\bbun install\b/);
  });

  test("CLI usage strings reference bun run", () => {
    const offenders = [];
    for (const name of ["test", "lint", "fix", "codegen", "dev"]) {
      const p = path.join(ROOT, "cli", name, `${name}.js`);
      if (!fs.existsSync(p)) continue;
      const text = fs.readFileSync(p, "utf8");
      if (/yarn run/.test(text)) offenders.push(`cli/${name}/${name}.js`);
    }
    expect(offenders).toEqual([]);
  });

  test("docker build uses bun", () => {
    const offenders = [];
    for (const rel of ["docker-build.sh", "fbg-server/Dockerfile"]) {
      const p = path.join(ROOT, rel);
      if (!fs.existsSync(p)) continue;
      if (/\byarn\b/.test(fs.readFileSync(p, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  test("root package.json declares a packageManager pin", () => {
    const pkg = readJson("package.json");
    expect(pkg.packageManager).toMatch(/^bun@/);
  });
});
