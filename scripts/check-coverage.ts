#!/usr/bin/env bun
/**
 * check-coverage.ts — Enforce minimum line coverage threshold.
 *
 * Runs `bun test --coverage` and parses the "All files" summary line.
 * Exits non-zero if line coverage is below THRESHOLD.
 */

const THRESHOLD = 90; // Minimum line coverage percentage

async function main() {
  const proc = Bun.spawn(
    ["bun", "test", "src/__tests__", "--coverage"],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NODE_ENV: "test" },
    },
  );

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  // Print test output
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  // Check if no test files were found (bun exits non-zero but it's not a real failure)
  const noTestFiles =
    stdout.includes("did not match any test files") ||
    stderr.includes("did not match any test files");

  if (noTestFiles) {
    console.log("\n⚠️  No test files found yet. Skipping coverage check.");
    process.exit(0);
  }

  // If tests failed, exit with same code
  if (exitCode !== 0) {
    console.error(`\n❌ Tests failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }

  // Parse coverage table — look for "All files" line
  // Format: "All files | <branch%> | <line%> |"
  const allFilesLine = stdout
    .split("\n")
    .find((line) => line.includes("All files"));

  if (!allFilesLine) {
    console.log("\n⚠️  No coverage data found (no test files yet). Skipping coverage check.");
    process.exit(0);
  }

  // Extract percentages: numbers like "85.71"
  const percentages = allFilesLine.match(/[\d.]+/g);
  if (!percentages || percentages.length < 2) {
    console.error("\n❌ Could not parse coverage percentages from:", allFilesLine);
    process.exit(1);
  }

  // Line coverage is the 2nd percentage
  const rawValue = percentages[1];
  if (rawValue === undefined) {
    console.error("\n❌ Could not parse line coverage percentage");
    process.exit(1);
  }
  const lineCoverage = parseFloat(rawValue);

  if (lineCoverage < THRESHOLD) {
    console.error(
      `\n❌ Line coverage ${lineCoverage.toFixed(1)}% is below threshold ${THRESHOLD}%`,
    );
    process.exit(1);
  }

  console.log(
    `\n✅ Line coverage ${lineCoverage.toFixed(1)}% meets threshold ${THRESHOLD}%`,
  );
}

main().catch((err) => {
  console.error("Coverage check failed:", err);
  process.exit(1);
});
