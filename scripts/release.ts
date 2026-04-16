#!/usr/bin/env bun
/**
 * Automated release script for noheir.
 *
 * Bumps version in package.json, syncs lockfile, generates CHANGELOG
 * entries from conventional commits, commits, tags, pushes, and
 * creates a GitHub release.
 *
 * Usage:
 *   bun run release              # patch bump (default)
 *   bun run release -- minor     # minor bump
 *   bun run release -- major     # major bump
 *   bun run release -- 2.0.0     # explicit version
 *   bun run release -- --dry-run # preview without side effects
 *
 * Env:
 *   Requires `gh` CLI authenticated for GitHub release creation.
 */

import { spawn } from "child_process";
import { resolve as pathResolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = pathResolve(import.meta.dirname as string, "..");
const PACKAGE_JSON = pathResolve(PROJECT_ROOT, "package.json");
const CHANGELOG = pathResolve(PROJECT_ROOT, "CHANGELOG.md");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; dryRun?: boolean; capture?: boolean },
): Promise<string> {
  const { cwd = PROJECT_ROOT, dryRun = false, capture = false } = opts ?? {};

  if (dryRun) {
    console.log(`  [dry-run] ${cmd} ${args.join(" ")}`);
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    });

    let stdout = "";
    let stderr = "";

    if (capture) {
      child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    }

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}\n${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path: string, data: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function bumpVersion(
  current: string,
  arg: string,
): string {
  const parts = current.split(".").map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  switch (arg) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default: {
      // Explicit version
      if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;
      throw new Error(`Invalid version argument: ${arg}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Changelog generation
// ---------------------------------------------------------------------------

interface CommitInfo {
  hash: string;
  type: string;
  scope: string;
  subject: string;
  breaking: boolean;
}

async function getCommitsSinceTag(tag: string | null): Promise<CommitInfo[]> {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const raw = await run(
    "git",
    ["log", range, "--pretty=format:%H %s"],
    { capture: true },
  );

  if (!raw) return [];

  const conventionalRe = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

  return raw
    .split("\n")
    .map((line) => {
      const hash = line.slice(0, 40);
      const msg = line.slice(41);
      const m = conventionalRe.exec(msg);
      if (!m) return null;
      return {
        hash,
        type: m[1] ?? "",
        scope: m[2] ?? "",
        subject: m[4] ?? "",
        breaking: m[3] === "!",
      } satisfies CommitInfo;
    })
    .filter(Boolean) as CommitInfo[];
}

function buildChangelogEntry(version: string, commits: CommitInfo[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`## [${version}] - ${date}`, ""];

  const sectionMap: Record<string, { title: string; items: string[] }> = {
    feat: { title: "Features", items: [] },
    fix: { title: "Fixes", items: [] },
    perf: { title: "Performance", items: [] },
    refactor: { title: "Refactoring", items: [] },
    docs: { title: "Documentation", items: [] },
    test: { title: "Tests", items: [] },
    chore: { title: "Chores", items: [] },
    ci: { title: "CI", items: [] },
    build: { title: "Build", items: [] },
    style: { title: "Style", items: [] },
  };

  const breaking: string[] = [];

  for (const c of commits) {
    if (c.breaking) {
      breaking.push(
        `- ${c.scope ? `**${c.scope}** — ` : ""}${c.subject} (${c.hash.slice(0, 7)})`,
      );
    }
    const section = sectionMap[c.type];
    if (section) {
      section.items.push(
        `- ${c.scope ? `**${c.scope}** — ` : ""}${c.subject}`,
      );
    }
  }

  if (breaking.length) {
    lines.push("### ⚠ Breaking Changes", "", ...breaking, "");
  }

  for (const s of Object.values(sectionMap)) {
    if (s.items.length) {
      lines.push(`### ${s.title}`, "", ...s.items, "");
    }
  }

  // If no conventional commits were grouped, add a note
  if (lines.length === 2) {
    lines.push("Maintenance release.", "");
  }

  return lines.join("\n");
}

function updateChangelog(entry: string): void {
  if (!existsSync(CHANGELOG)) {
    writeFileSync(
      CHANGELOG,
      `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n${entry}`,
    );
    return;
  }

  const content = readFileSync(CHANGELOG, "utf-8");
  // Insert after the header block
  const marker = "All notable changes to this project will be documented in this file.";
  const idx = content.indexOf(marker);

  if (idx !== -1) {
    const insertAt = idx + marker.length;
    const updated =
      content.slice(0, insertAt) + "\n\n" + entry + content.slice(insertAt).replace(/^\n+/, "\n");
    writeFileSync(CHANGELOG, updated);
  } else {
    // Fallback: prepend after first line
    const firstNewline = content.indexOf("\n");
    const updated =
      content.slice(0, firstNewline + 1) + "\n" + entry + content.slice(firstNewline + 1);
    writeFileSync(CHANGELOG, updated);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const versionArg = args.find((a) => a !== "--dry-run") ?? "patch";

  console.log(dryRun ? "🏃 Dry run mode\n" : "");

  // 1. Read current version
  const pkg = readJson(PACKAGE_JSON) as Record<string, unknown> & {
    version: string;
  };
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, versionArg);

  console.log(`📦 ${oldVersion} → ${newVersion}\n`);

  // 2. Bump package.json
  pkg.version = newVersion;
  if (!dryRun) {
    writeJson(PACKAGE_JSON, pkg);
    console.log("✅ Updated package.json");
  } else {
    console.log("  [dry-run] Would update package.json");
  }

  // 3. Sync lockfile
  console.log("\n📦 Syncing lockfile...");
  await run("bun", ["install"], { dryRun });

  // 4. Generate changelog
  console.log("\n📝 Generating changelog...");
  const lastTag = await run("git", ["describe", "--tags", "--abbrev=0"], {
    capture: true,
  }).catch(() => null);

  const commits = await getCommitsSinceTag(lastTag);
  console.log(`   Found ${commits.length} conventional commit(s) since ${lastTag ?? "beginning"}`);

  const entry = buildChangelogEntry(newVersion, commits);

  if (!dryRun) {
    updateChangelog(entry);
    console.log("✅ Updated CHANGELOG.md");
  } else {
    console.log("  [dry-run] Changelog entry:\n");
    console.log(entry);
  }

  // 5. Commit and tag
  const tag = `v${newVersion}`;

  console.log("\n🔖 Committing and tagging...");
  await run("git", ["add", "package.json", "bun.lock", "CHANGELOG.md"], { dryRun });
  await run("git", ["commit", "-m", `release: ${tag}`], { dryRun });
  await run("git", ["tag", tag, "-m", tag], { dryRun });

  // 6. Push
  console.log("\n🚀 Pushing...");
  await run("git", ["push"], { dryRun });
  await run("git", ["push", "--tags"], { dryRun });

  // 7. GitHub release
  console.log("\n🎉 Creating GitHub release...");
  await run(
    "gh",
    ["release", "create", tag, "--title", tag, "--notes", entry],
    { dryRun },
  );

  console.log(`\n✅ Released ${tag}`);
}

main().catch((err) => {
  console.error("\n❌ Release failed:", err.message);
  process.exit(1);
});
