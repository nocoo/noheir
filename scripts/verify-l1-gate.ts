import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
let owned = "";
let clone = "";
let failed = 0;

type HookResult = { status: number | null; output: string };

const METRICS = ["statements", "branches", "functions", "lines"] as const;

function check(name: string, ok: boolean, detail = "") {
  const text = detail.replace(/\s+/g, " ").trim().slice(0, 320);
  console.log(`${ok ? "ok" : "FAIL"} ${name}${text ? `: ${text}` : ""}`);
  if (!ok) failed = 1;
}

function runGit(args: string[], cwd = clone) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function runHook(env: Record<string, string> = {}): HookResult {
  const scratch = join(clone, ".l1-scratch");
  mkdirSync(scratch, { recursive: true });
  const child = spawnSync("sh", [".husky/pre-commit"], {
    cwd: clone,
    env: { ...process.env, TMPDIR: scratch, ...env },
    encoding: "utf8",
    timeout: 180_000,
  });
  return {
    status: child.status,
    output: `${child.stdout ?? ""}\n${child.stderr ?? ""}`,
  };
}

function resetTree() {
  runGit(["reset", "--hard", "HEAD"]);
  runGit(["clean", "-fd", "-e", ".l1-scratch", "-e", ".l1-scratch-interrupt"]);
}

function stage(path: string, content: string) {
  writeFileSync(join(clone, path), content);
  runGit(["add", "--", path]);
}

function readTree(path: string) {
  return readFileSync(join(clone, path), "utf8");
}

function expectReject(
  name: string,
  result: HookResult,
  pattern: RegExp | string,
  extra?: () => void,
) {
  const output = result.output;
  const matched =
    result.status !== 0 &&
    (typeof pattern === "string" ? output.includes(pattern) : pattern.test(output));
  check(name, matched, matched ? "" : output);
  extra?.();
}

function cloneFixture() {
  owned = mkdtempSync(join(tmpdir(), "noheir-l1-verify-"));
  clone = join(owned, "repo");
  execFileSync("git", ["clone", "--no-hardlinks", "--quiet", `file://${repo}`, clone], {
    encoding: "utf8",
  });
  if (existsSync(join(repo, "node_modules"))) {
    symlinkSync(join(repo, "node_modules"), join(clone, "node_modules"));
  }
  if (existsSync(join(repo, "worker/node_modules"))) {
    symlinkSync(join(repo, "worker/node_modules"), join(clone, "worker/node_modules"));
  }
  runGit(["checkout", "-B", "l1-gate-fixture"]);
  runGit(["config", "user.email", "l1-gate@example.test"]);
  runGit(["config", "user.name", "L1 Gate Fixture"]);
  const livePreCommit = readFileSync(join(repo, "scripts/pre-commit.py"), "utf8");
  const clonedPreCommit = readFileSync(join(clone, "scripts/pre-commit.py"), "utf8");
  if (livePreCommit !== clonedPreCommit) {
    writeFileSync(join(clone, "scripts/pre-commit.py"), livePreCommit);
    runGit(["add", "scripts/pre-commit.py"]);
    runGit(["commit", "-q", "-m", "sync pre-commit launcher for L1 probes"]);
  }
  execFileSync("bun", ["run", "prepare"], { cwd: clone, stdio: "inherit" });
  chmodSync(join(clone, ".husky/pre-commit"), 0o755);
}

function benchHealthy() {
  const scratch = join(repo, ".l1-bench-scratch");
  mkdirSync(scratch, { recursive: true });
  const times: number[] = [];
  for (const label of ["cold", "warm"]) {
    const start = performance.now();
    const child = spawnSync("sh", [".husky/pre-commit"], {
      cwd: repo,
      env: { ...process.env, TMPDIR: scratch },
      encoding: "utf8",
      timeout: 180_000,
    });
    const elapsed = (performance.now() - start) / 1000;
    times.push(elapsed);
    check(`benchmark ${label} pre-commit exit 0`, child.status === 0, child.stderr);
    console.log(`METRIC precommit_${label}_s=${elapsed.toFixed(2)}`);
    const match = child.stdout.match(
      /app-coverage coverage: statements=([\d.]+)%, branches=([\d.]+)%, functions=([\d.]+)%, lines=([\d.]+)%[\s\S]*?worker-coverage coverage: statements=([\d.]+)%, branches=([\d.]+)%, functions=([\d.]+)%, lines=([\d.]+)%/,
    );
    if (match) {
      console.log(
        `METRIC app_coverage=${match.slice(1, 5).join(",")} worker_coverage=${match.slice(5, 9).join(",")}`,
      );
    }
  }
  const warm = times[1] ?? times[0] ?? 0;
  const cold = times[0] ?? 0;
  console.log(`METRIC precommit_warm_minus_cold_s=${(warm - cold).toFixed(2)}`);
}

async function runInterruptProbe() {
  const interruptScratch = join(clone, ".l1-scratch-interrupt");
  mkdirSync(interruptScratch, { recursive: true });
  const interrupted = await new Promise<HookResult>((resolveDone) => {
    const child = spawn("sh", [".husky/pre-commit"], {
      cwd: clone,
      env: { ...process.env, TMPDIR: interruptScratch, NOHEIR_L1_TIMEOUT_SEC: "120" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGINT");
      } catch {
        /* already exited */
      }
    }, 8000);
    child.on("close", (code) => resolveDone({ status: code, output }));
  });
  check("interrupt does not succeed", interrupted.status !== 0, interrupted.output);
}

async function runProbes() {
  try {
    cloneFixture();

    const selfTest = spawnSync("python3", ["-B", "scripts/pre-commit.py", "--self-test"], {
      cwd: clone,
      encoding: "utf8",
    });
    check(
      "pre-commit helper self-test (missing report/malformed coverage)",
      selfTest.status === 0,
      selfTest.stderr,
    );

    const cleanupTest = spawnSync("python3", ["-B", "scripts/pre-commit.py", "--cleanup-test"], {
      cwd: clone,
      encoding: "utf8",
      timeout: 15_000,
    });
    check(
      "process-group cleanup kills descendants after leader exit",
      cleanupTest.status === 0,
      `${cleanupTest.stdout ?? ""}${cleanupTest.stderr ?? ""}`,
    );

    resetTree();
    const healthy = runHook();
    check("healthy index snapshot passes", healthy.status === 0, healthy.output);

    const commitScratch = join(clone, ".l1-scratch");
    mkdirSync(commitScratch, { recursive: true });
    const commitChild = spawnSync("git", ["commit", "--allow-empty", "-m", "l1 healthy commit"], {
      cwd: clone,
      env: { ...process.env, TMPDIR: commitScratch },
      encoding: "utf8",
      timeout: 180_000,
    });
    check(
      "healthy Husky commit succeeds",
      commitChild.status === 0 && !commitChild.stderr.includes("pre-commit script failed"),
      `${commitChild.stdout}\n${commitChild.stderr}`,
    );
    resetTree();

    const failingUt = readTree("worker/tests/live.test.ts").replace("toBe(200)", "toBe(404)");
    stage("worker/tests/live.test.ts", failingUt);
    const passWt = readTree("worker/tests/live.test.ts").replace("toBe(404)", "toBe(200)");
    writeFileSync(join(clone, "worker/tests/live.test.ts"), passWt);
    const ut = runHook();
    expectReject("failing UT rejects", ut, "Failed Tests");
    check(
      "UT probe keeps unstaged fix",
      readTree("worker/tests/live.test.ts").includes("toBe(200)"),
    );
    check(
      "UT probe retains failing index",
      runGit(["show", ":worker/tests/live.test.ts"]).includes("toBe(404)"),
    );
    resetTree();

    for (const metric of METRICS) {
      const source = readTree("vitest.config.ts");
      const staged = source.replace(`${metric}: 95`, `${metric}: 101`);
      stage("vitest.config.ts", staged);
      const cov = runHook();
      expectReject(`app ${metric} coverage floor rejects`, cov, new RegExp(metric, "i"));
      resetTree();
    }

    for (const metric of METRICS) {
      const source = readTree("worker/vitest.config.ts");
      const staged = source.replace(`${metric}: 95`, `${metric}: 101`);
      stage("worker/vitest.config.ts", staged);
      const cov = runHook();
      expectReject(`worker ${metric} coverage floor rejects`, cov, new RegExp(metric, "i"));
      resetTree();
    }

    stage("src/l1-probe-lint.ts", "export function probe() {\n  debugger;\n}\n");
    const lint = runHook();
    expectReject("lint error rejects", lint, "noDebugger");
    resetTree();

    stage("src/l1-probe-warning.css", ".l1-probe { color: red !important; }\n");
    const warn = runHook();
    expectReject("lint warning rejects", warn, "noImportantStyles");
    resetTree();

    stage("src/l1-probe-type.ts", 'export const broken: number = "not-a-number";\n');
    const types = runHook();
    expectReject("type error rejects", types, "TS2322");
    resetTree();

    const onlyTest = readTree("worker/tests/live.test.ts").replace(
      'test("connected',
      'test.only("connected',
    );
    stage("worker/tests/live.test.ts", onlyTest);
    const only = runHook();
    expectReject("focused .only rejects", only, /allowOnly|FAIL|Only/i);
    resetTree();

    const skipped = readTree("worker/tests/live.test.ts").replace(
      'test("connected',
      'test.skip("connected',
    );
    stage("worker/tests/live.test.ts", skipped);
    const skip = runHook();
    expectReject("skipped required test rejects", skip, /skipped|Pending|numPendingTests|FAIL/i);
    resetTree();

    const badStaged = readTree("worker/tests/live.test.ts").replace("toBe(200)", "toBe(0)");
    const goodWorktree = readTree("worker/tests/live.test.ts");
    stage("worker/tests/live.test.ts", badStaged);
    writeFileSync(join(clone, "worker/tests/live.test.ts"), goodWorktree);
    const indexProbe = runHook();
    expectReject("staged failure with unstaged fix rejects", indexProbe, "AssertionError");
    check(
      "index mismatch leaves worktree healthy",
      readTree("worker/tests/live.test.ts").includes("toBe(200)"),
    );
    resetTree();

    stage("src/l1-probe-lint.ts", "export function parallelLintLane() {\n  debugger;\n}\n");
    const failingUt2 = readTree("worker/tests/live.test.ts").replace("toBe(200)", "toBe(0)");
    stage("worker/tests/live.test.ts", failingUt2);
    const parallel = runHook();
    expectReject(
      "parallel lanes preserve a failure",
      parallel,
      /(lint failed|Failed Tests|pre-commit failed)/i,
    );
    resetTree();

    let appVitest = readTree("vitest.config.ts");
    for (const target of [
      'include: ["src/__tests__/**/*.test.ts"]',
      'include: ["src/__tests__/**/*.test.tsx"]',
    ]) {
      appVitest = appVitest.replace(target, 'include: ["**/__l1_probe_none__.ts"]');
    }
    stage("vitest.config.ts", appVitest);
    const empty = runHook();
    expectReject(
      "empty required suite rejects",
      empty,
      /No test files|numTotalTests|Missing, empty|unsuccessful test report/i,
    );
    resetTree();

    const noSummaryApp = readTree("vitest.config.ts").replace(
      'reporter: ["text", "html", "json-summary"]',
      'reporter: ["text", "html"]',
    );
    const noSummaryWorker = readTree("worker/vitest.config.ts").replace(
      'reporter: ["text", "html", "json-summary"]',
      'reporter: ["text", "html"]',
    );
    stage("vitest.config.ts", noSummaryApp);
    stage("worker/vitest.config.ts", noSummaryWorker);
    const missingReport = runHook();
    expectReject(
      "missing coverage summary rejects",
      missingReport,
      /coverage-summary|Missing total coverage|pre-commit failed/i,
    );
    resetTree();

    const missingBin = join(owned, "minimal-path");
    mkdirSync(missingBin, { recursive: true });
    symlinkSync(
      execFileSync("which", ["git"], { encoding: "utf8" }).trim(),
      join(missingBin, "git"),
    );
    symlinkSync(process.execPath, join(missingBin, "node"));
    const missing = runHook({ PATH: `${missingBin}:/usr/bin:/bin` });
    expectReject("missing bun rejects", missing, /Missing required tool: bun|ENOENT|not found/i);

    resetTree();
    const timeout = runHook({ NOHEIR_L1_TIMEOUT_SEC: "1" });
    expectReject("timeout rejects", timeout, /exceeded|timed out|TIMEOUT|L1 checks exceeded/i);

    await runInterruptProbe();

    const hooksBefore = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    const hooksAfter = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    check("development hooks unchanged", hooksBefore === hooksAfter, hooksAfter);
  } finally {
    if (owned) rmSync(owned, { recursive: true, force: true });
  }
}

const bench = process.argv.includes("--benchmark");
if (bench) benchHealthy();

await runProbes();

if (failed) {
  console.error("L1 gate verification failed");
  process.exit(failed);
}
console.log("L1 gate verification passed");
