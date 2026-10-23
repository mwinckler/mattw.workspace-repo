const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");

function query(t, output, exitCode = 0) {
  const directory = mkdtempSync(join(existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir(), "workspace-repo-"));
  t.after(() => { rmSync(directory, { recursive: true, force: true }); });
  const log = join(directory, "arguments.json");
  writeFileSync(join(directory, "hyprctl"), `#!/usr/bin/env node
require("node:fs").writeFileSync(process.env.ARGUMENT_LOG, JSON.stringify(process.argv.slice(2)));
process.stdout.write(process.env.SNAPSHOT_OUTPUT);
process.exit(Number(process.env.SNAPSHOT_EXIT));
`, { mode: 0o755 });
  const result = spawnSync("bash", [join(__dirname, "../snapshot.sh")], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: directory + ":" + process.env.PATH,
      HOME: "/home/test user",
      ARGUMENT_LOG: log,
      SNAPSHOT_OUTPUT: output,
      SNAPSHOT_EXIT: String(exitCode),
    },
  });
  return { ...result, arguments: existsSync(log) ? JSON.parse(readFileSync(log, "utf8")) : [] };
}

test("snapshot uses one batch query and preserves off-screen window coordinates and title data", (t) => {
  const clients = [{
    address: "0x123", class: "foot", tags: ["terminal*"],
    title: "mattw@mattarchy:/tmp/$(touch should-not-run); <project>",
    workspace: { id: 3, name: "3" }, at: [-5000, 25], mapped: true,
  }];
  const monitors = [{ name: "DP-1", activeWorkspace: { id: 3 }, specialWorkspace: { id: 0 } }];
  const result = query(t, [clients, monitors, { address: "0x123" }].map(JSON.stringify).join("\n"));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.arguments, ["--batch", "-j", "clients;monitors;activewindow"]);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.clients, clients);
  assert.deepEqual(data.monitors, monitors);
  assert.equal(data.activeAddress, "0x123");
  assert.equal(data.home, "/home/test user");
  assert.equal(data.host, spawnSync("hostname", { encoding: "utf8" }).stdout.trim());
});

test("snapshot tolerates no active window", (t) => {
  const result = query(t, "[]\n[]\n{}");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).activeAddress, "");
});

test("snapshot fails on IPC errors rather than supplying a previous label", (t) => {
  const result = query(t, "", 1);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});

test("snapshot fails on malformed IPC data", (t) => {
  const result = query(t, "not json");
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});

test("manifest registers the native widget and all entry points exist", () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "mattw.workspace-repo");
  assert.deepEqual(manifest.kinds, ["bar-widget"]);
  assert.equal(manifest.barWidget.defaultSection, "left");
  for (const entry of Object.values(manifest.entryPoints)) {
    assert.equal(existsSync(join(__dirname, "..", entry)), true, entry);
  }
});
