const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { test } = require("node:test");

test("native QML widget loads, animates inline, refreshes per monitor, and fully hides", {
  skip: !existsSync("/usr/share/omarchy/shell"),
}, (t) => {
  const directory = mkdtempSync(join(existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir(), "workspace-repo-qml-"));
  t.after(() => { rmSync(directory, { recursive: true, force: true }); });
  for (const name of ["Commons", "Ui"]) {
    symlinkSync(join("/usr/share/omarchy/shell", name), join(directory, name));
  }
  symlinkSync(resolve(__dirname, ".."), join(directory, "plugin"));
  copyFileSync(join(__dirname, "widget.qml"), join(directory, "shell.qml"));
  writeFileSync(join(directory, "snapshot.sh"), '#!/usr/bin/env bash\nprintf "%s\\n" "$WORKSPACE_REPO_FIXTURE"\n');
  const fixture = {
    home: "/home/mattw", host: "mattarchy", activeAddress: "focused",
    monitors: [
      { name: "DP-1", activeWorkspace: { id: 3 } },
      { name: "DP-2", activeWorkspace: { id: 4 } },
    ],
    clients: [
      { address: "focused", class: "foot", title: "mattw@mattarchy:~/src/project <literal>", workspace: { id: 3 }, at: [0, 0] },
      { address: "other", class: "foot", title: "jjui - /srv/other", workspace: { id: 4 }, at: [0, 0] },
    ],
  };
  const result = spawnSync("quickshell", ["--no-color", "-p", directory], {
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, QT_QPA_PLATFORM: "offscreen", WORKSPACE_REPO_FIXTURE: JSON.stringify(fixture) },
  });
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 0, output);
  assert.match(output, /workspace-repo widget smoke test passed/);
  assert.doesNotMatch(output, /ReferenceError|TypeError|Binding loop|Unable to assign|Error loading configuration/);
});
