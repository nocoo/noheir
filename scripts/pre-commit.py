import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

TIMEOUT = 240
METRICS = ("statements", "branches", "functions", "lines")
DEPENDENCIES = ("node_modules", "worker/node_modules")


def run(args, cwd, env=None, capture=False, input_data=None):
    result = subprocess.run(
        args,
        cwd=cwd,
        env=env,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        input=input_data,
        text=True,
        timeout=30,
    )
    return result.stdout if capture else None


def link_dependencies(source, target, root, snapshot):
    root = root.resolve()
    snapshot = snapshot.resolve()
    if not source.is_dir():
        raise RuntimeError(f"Missing installed dependencies: {source}")
    target.mkdir(parents=True, exist_ok=True)
    for entry in source.iterdir():
        if entry.name.startswith(".") and entry.name not in (".bin", ".bun"):
            continue
        destination = target / entry.name
        if entry.name.startswith("@") and entry.is_dir():
            link_dependencies(entry, destination, root, snapshot)
            continue
        resolved = entry.resolve()
        if resolved.is_relative_to(root) and "node_modules" not in resolved.relative_to(root).parts:
            resolved = snapshot / resolved.relative_to(root)
        destination.symlink_to(resolved, target_is_directory=entry.is_dir())


def check_tests(path):
    report = json.loads(path.read_text())
    total = report.get("numTotalTests")
    passed = report.get("numPassedTests")
    if not report.get("success") or not isinstance(total, int) or isinstance(total, bool) or total <= 0:
        raise RuntimeError(f"Missing, empty, or unsuccessful test report: {path}")
    if passed != total or report.get("numFailedTests") != 0 or report.get("numPendingTests") != 0 or report.get("numTodoTests") != 0:
        raise RuntimeError(f"Failed, skipped, or malformed required test report: {path}")
    print(f"{path.name}: {passed}/{total} tests passed, 0 skipped", flush=True)


def check_coverage(path):
    report = json.loads(path.read_text())
    total = report.get("total")
    if not isinstance(total, dict):
        raise RuntimeError(f"Missing total coverage summary: {path}")
    values = {}
    for metric in METRICS:
        result = total.get(metric)
        if not isinstance(result, dict):
            raise RuntimeError(f"Missing {metric} coverage in {path}")
        value = result.get("pct")
        count = result.get("total")
        covered = result.get("covered")
        if (
            not isinstance(value, (int, float))
            or not math.isfinite(value)
            or not 0 <= value <= 100
            or not isinstance(count, int)
            or isinstance(count, bool)
            or count <= 0
            or not isinstance(covered, int)
            or isinstance(covered, bool)
            or not 0 <= covered <= count
            or value < 95
        ):
            raise RuntimeError(f"Missing, inconsistent, empty, or below-floor {metric} coverage in {path}: {value}")
        values[metric] = value
    print(f"{path.parent.name} coverage: " + ", ".join(f"{metric}={values[metric]:.2f}%" for metric in METRICS), flush=True)


def self_test():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory) / "repo"
        snapshot = Path(directory) / "snapshot"
        source = root / "node_modules"
        (source / ".cache").mkdir(parents=True)
        (source / ".bin").mkdir()
        (source / "pkg").mkdir()
        (root / "workspace").mkdir(parents=True)
        (root / "workspace" / "index.js").write_text("ok")
        (snapshot / "workspace").mkdir(parents=True)
        (source / "pkg" / "index.js").write_text("dependency")
        (source / "local-package").symlink_to(root / "workspace", target_is_directory=True)
        (source / ".cache" / "secret").write_text("excluded")
        (source / ".bin" / "tool").write_text("binary")
        link_dependencies(source, snapshot / "node_modules", root, snapshot)
        assert not (snapshot / "node_modules" / ".cache").exists()
        assert (snapshot / "node_modules" / ".bin" / "tool").is_file()
        assert (snapshot / "node_modules" / "pkg").is_symlink()
        assert (snapshot / "node_modules" / "local-package").resolve() == (snapshot / "workspace").resolve()
        report = Path(directory) / "tests.json"
        report.write_text(json.dumps({"success": True, "numTotalTests": 1, "numPassedTests": 1, "numFailedTests": 0, "numPendingTests": 0, "numTodoTests": 0}))
        check_tests(report)
        report.write_text(json.dumps({"success": True, "numTotalTests": 1, "numPassedTests": 0, "numFailedTests": 0, "numPendingTests": 1, "numTodoTests": 0}))
        try:
            check_tests(report)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Skipped test report was accepted")
        report.write_text(json.dumps({"total": {key: {"total": 20, "covered": 19, "pct": 95} for key in METRICS}}))
        check_coverage(report)
        report.write_text(json.dumps({"total": {key: {"total": 100, "covered": 94, "pct": 94} for key in METRICS}}))
        try:
            check_coverage(report)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Below-floor coverage was accepted")
        report.write_text(json.dumps({"total": {key: {"total": 100, "covered": 95, "pct": float("nan")} for key in METRICS}}))
        try:
            check_coverage(report)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Non-finite coverage was accepted")
    print("pre-commit helper checks passed")


def terminate(processes):
    for process, _ in processes:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 3
    for process, _ in processes:
        if process.poll() is None:
            try:
                process.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                pass
    for process, _ in processes:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    for process, _ in processes:
        process.wait()


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        return
    for tool in ("git", "bun", "node"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"Missing required tool: {tool}")
    root = Path(run(("git", "rev-parse", "--show-toplevel"), Path.cwd(), capture=True).strip())
    with tempfile.TemporaryDirectory(prefix="noheir-l1-") as temporary:
        temp = Path(temporary)
        snapshot = temp / "snapshot"
        snapshot.mkdir()
        paths = run(("git", "ls-files", "-z"), root, capture=True).split("\0")[:-1]
        selected = [
            path for path in paths
            if not any(part.startswith(".env") and part not in (".env.example", ".env.test") for part in Path(path).parts)
            and path != "worker/.dev.vars"
        ]
        run(("git", "checkout-index", "--force", "--stdin", "-z", f"--prefix={snapshot}/"), root, input_data="\0".join(selected) + "\0")
        for relative in DEPENDENCIES:
            link_dependencies(root / relative, snapshot / relative, root, snapshot)
        env = {key: os.environ[key] for key in ("PATH", "HOME", "LANG", "LC_ALL", "DEVELOPER_DIR", "SDKROOT") if key in os.environ}
        env.update({"CI": "1", "NODE_ENV": "test", "NO_COLOR": "1", "TMPDIR": str(temp / "tmp"), "XDG_CACHE_HOME": str(temp / "cache"), "VITEST_COVERAGE_DIR": str(temp / "coverage")})
        for name in ("tmp", "cache", "coverage"):
            (temp / name).mkdir()
        run((sys.executable, "-B", "scripts/pre-commit.py", "--self-test"), snapshot, env)
        commands = (
            ("app tests and coverage", ("bun", "run", "test:coverage", "--allowOnly=false", "--maxWorkers=4", "--coverage.reportsDirectory", str(temp / "app-coverage"), "--reporter=default", "--reporter=json", f"--outputFile={temp / 'app-tests.json'}")),
            ("worker tests and coverage", ("bun", "run", "--cwd", "worker", "test:coverage", "--allowOnly=false", "--maxWorkers=4", "--coverage.reportsDirectory", str(temp / "worker-coverage"), "--reporter=default", "--reporter=json", f"--outputFile={temp / 'worker-tests.json'}")),
            ("lint", ("bun", "run", "lint")),
            ("typecheck", ("bun", "run", "typecheck")),
        )
        processes = []
        started = time.monotonic()
        deadline = started + TIMEOUT
        try:
            for name, command in commands:
                log = (temp / (name.split()[0] + ".log")).open("w")
                stage_started = time.monotonic()
                process = subprocess.Popen(command, cwd=snapshot, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                processes.append((process, (name, log, stage_started)))
            pending = set(range(len(processes)))
            while pending:
                for index in tuple(pending):
                    process, (name, log, stage_started) = processes[index]
                    result = process.poll()
                    if result is not None:
                        log.close()
                        pending.remove(index)
                        if result:
                            print(f"{name} failed (exit {result})", file=sys.stderr)
                            print(Path(log.name).read_text(), file=sys.stderr)
                            raise RuntimeError(f"{name} failed")
                        print(f"{name} passed in {time.monotonic() - stage_started:.2f}s", flush=True)
                if pending and time.monotonic() >= deadline:
                    raise TimeoutError(f"L1 checks exceeded {TIMEOUT}s")
                if pending:
                    time.sleep(0.1)
            for _, (_, log, _) in processes:
                if not log.closed:
                    log.close()
                print(Path(log.name).read_text(), end="", flush=True)
            for report in ("app-tests.json", "worker-tests.json"):
                check_tests(temp / report)
            check_coverage(temp / "app-coverage/coverage-summary.json")
            check_coverage(temp / "worker-coverage/coverage-summary.json")
            print(f"L1 index snapshot passed in {time.monotonic() - started:.2f}s", flush=True)
        finally:
            terminate(processes)
            for _, (_, log, _) in processes:
                if not log.closed:
                    log.close()


def interrupted(signum, _frame):
    raise SystemExit(128 + signum)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, TimeoutError, subprocess.SubprocessError) as error:
        print(f"pre-commit failed: {error}", file=sys.stderr)
        sys.exit(1)
