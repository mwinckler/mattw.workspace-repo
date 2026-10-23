const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

// Load the same plain JavaScript namespace that QML imports, without a Node-only export shim.
const { parseTitle, selectRepository } = runInNewContext(
  readFileSync(join(__dirname, "../RepositoryModel.js"), "utf8")
    + "\n;({ parseTitle, selectRepository });"
);

const context = { home: "/home/mattw", host: "mattarchy" };

function terminal(title, overrides = {}) {
  return {
    address: "shell",
    class: "foot",
    title,
    workspace: { id: 3 },
    at: [0, 0],
    mapped: true,
    ...overrides,
  };
}

function snapshot(clients = [], overrides = {}) {
  return {
    ...context,
    monitors: [
      { name: "DP-1", activeWorkspace: { id: 3 }, specialWorkspace: { id: 0 } },
      { name: "DP-2", activeWorkspace: { id: 4 }, specialWorkspace: { id: 0 } },
    ],
    clients,
    activeAddress: "",
    ...overrides,
  };
}

const validTitles = [
  ["/home/mattw/src/treefort-ott", "/home/mattw/src/treefort-ott"],
  ["~/src/treefort-ott", "/home/mattw/src/treefort-ott"],
  ["~", "/home/mattw"],
  ["/", "/"],
  ["/tmp/project///", "/tmp/project"],
  ["jjui - /home/mattw/src/treefort-ott", "/home/mattw/src/treefort-ott"],
  ["jjui - ~/src/project with spaces", "/home/mattw/src/project with spaces"],
  ["mattw@mattarchy:~/src/treefort-ott", "/home/mattw/src/treefort-ott"],
  ["other-user@mattarchy:/tmp/project with spaces", "/tmp/project with spaces"],
  ["mattw@mattarchy:~", "/home/mattw"],
  ["/tmp/$(touch should-not-run); 'quoted' <b>project</b>", "/tmp/$(touch should-not-run); 'quoted' <b>project</b>"],
];

for (const [title, expected] of validTitles) {
  test(`parse local title: ${title}`, () => {
    assert.equal(parseTitle(title, context), expected);
  });
}

const invalidTitles = [
  "", " ", null, undefined, 42, {},
  "mattarchy: wildlands", "treefort-ott", "nvim README.md", "src/treefort-ott",
  "mattw@remote:~/src/treefort-ott", "mattw@remote:/home/mattw/src/treefort-ott",
  "mattw@mattarchy.evil:~/src/treefort-ott", "remote:/tmp/project",
  "jjui - mattw@remote:/tmp/project", "jjui - project", "jjui - ",
  "https://example.com/project", "ssh://mattarchy/tmp/project", "file:///tmp/project",
  "//remote/share", "~other/src/project", "$HOME/src/project",
  "/tmp/project\nother", "/tmp/\u001b[31mproject", "/tmp/\u0000project",
];

for (const title of invalidTitles) {
  test(`reject malformed or non-local title: ${JSON.stringify(title)}`, () => {
    assert.equal(parseTitle(title, context), "");
  });
}

test("accept the local hostname's short and full forms, but not other hosts", () => {
  const fqdn = { ...context, host: "mattarchy.example.net" };
  assert.equal(parseTitle("mattw@mattarchy:~/src/project", fqdn), "/home/mattw/src/project");
  assert.equal(parseTitle("mattw@MATTARCHY.EXAMPLE.NET:/tmp/project", fqdn), "/tmp/project");
  assert.equal(parseTitle("mattw@remote.example.net:/tmp/project", fqdn), "");
});

test("a focused local terminal overrides jjui, including home and non-repository directories", () => {
  const data = snapshot([
    terminal("jjui - /src/repo", { address: "jjui", at: [-5000, 0] }),
    terminal("mattw@mattarchy:~"),
  ], { activeAddress: "shell" });
  assert.equal(selectRepository(data, "DP-1"), "/home/mattw");
  data.clients[1].title = "/tmp/not-a-repository";
  assert.equal(selectRepository(data, "DP-1"), "/tmp/not-a-repository");
});

test("browser focus selects jjui before a farther-left shell", () => {
  const data = snapshot([
    terminal("mattw@mattarchy:/src/shell", { at: [-9000, 0] }),
    terminal("jjui - /src/jjui", { address: "jjui", at: [300, 0] }),
    terminal("/src/browser-spoof", { address: "browser", class: "chromium" }),
  ], { activeAddress: "browser" });
  assert.equal(selectRepository(data, "DP-1"), "/src/jjui");
});

test("invalid or remote focused titles do not suppress fallback", () => {
  for (const title of ["mattarchy: wildlands", "mattw@remote:/src/remote"]) {
    const data = snapshot([
      terminal(title),
      terminal("jjui - /src/local", { address: "jjui" }),
    ], { activeAddress: "shell" });
    assert.equal(selectRepository(data, "DP-1"), "/src/local");
  }
});

test("leftmost jjui includes windows scrolled off-screen", () => {
  const data = snapshot([
    terminal("jjui - /src/right", { at: [500, 0] }),
    terminal("jjui - /src/offscreen", { at: [-5000, 0], visible: false }),
  ]);
  assert.equal(selectRepository(data, "DP-1"), "/src/offscreen");
});

test("leftmost shell-title fallback includes ordinary shells and Neovim's existing title", () => {
  const data = snapshot([
    terminal("mattw@mattarchy:~/src/neovim", { at: [100, 0] }),
    terminal("mattw@mattarchy:/tmp/ordinary-shell", { at: [-2000, 0] }),
  ]);
  assert.equal(selectRepository(data, "DP-1"), "/tmp/ordinary-shell");
});

test("unfocused bare-path terminals are not shell-title fallback candidates", () => {
  assert.equal(selectRepository(snapshot([terminal("/src/bare")]), "DP-1"), "");
});

test("coordinate ties use Y, then original snapshot order, without mutating the input", () => {
  for (const prefix of ["jjui - ", "mattw@mattarchy:"]) {
    const clients = [
      terminal(prefix + "/src/lower", { at: [-100, 50] }),
      terminal(prefix + "/src/first", { at: [-100, 20] }),
      terminal(prefix + "/src/second", { at: [-100, 20] }),
    ];
    const data = snapshot(clients);
    const before = JSON.stringify(data);
    assert.equal(selectRepository(data, "DP-1"), "/src/first");
    assert.equal(JSON.stringify(data), before);
  }
});

test("each monitor labels its own displayed workspace, not the globally focused workspace", () => {
  const data = snapshot([
    terminal("mattw@mattarchy:/src/focused"),
    terminal("jjui - /src/other-monitor", { address: "other", workspace: { id: 4 } }),
  ], { activeAddress: "shell" });
  assert.equal(selectRepository(data, "DP-1"), "/src/focused");
  assert.equal(selectRepository(data, "DP-2"), "/src/other-monitor");
  assert.equal(selectRepository(data, "missing-monitor"), "");
  assert.equal(selectRepository(data, ""), "");
});

test("workspace switches and window moves cannot leak labels from other workspaces", () => {
  const data = snapshot([terminal("jjui - /src/repo")]);
  assert.equal(selectRepository(data, "DP-1"), "/src/repo");
  data.monitors[0].activeWorkspace.id = 5;
  assert.equal(selectRepository(data, "DP-1"), "");
  data.clients[0].workspace.id = 5;
  assert.equal(selectRepository(data, "DP-1"), "/src/repo");
});

test("an open special workspace is the workspace displayed on that monitor", () => {
  const data = snapshot([
    terminal("jjui - /src/regular"),
    terminal("jjui - /src/special", { workspace: { id: -99 } }),
  ]);
  data.monitors[0].specialWorkspace.id = -99;
  assert.equal(selectRepository(data, "DP-1"), "/src/special");
});

test("recognize terminal app IDs and Hyprland terminal tags, never browser titles alone", () => {
  for (const appId of ["foot", "footclient", "Alacritty", "kitty", "com.mitchellh.ghostty", "org.wezfurlong.wezterm"]) {
    const data = snapshot([terminal("jjui - /src/repo", { class: appId })]);
    assert.equal(selectRepository(data, "DP-1"), "/src/repo");
  }
  assert.equal(selectRepository(snapshot([
    terminal("jjui - /src/tagged", { class: "custom-terminal", tags: ["terminal*"] }),
  ]), "DP-1"), "/src/tagged");
  assert.equal(selectRepository(snapshot([
    terminal("jjui - /src/spoof", { class: "chromium" }),
  ], { activeAddress: "shell" }), "DP-1"), "");
});

test("unmapped windows and unusable titles do not block a valid fallback", () => {
  const data = snapshot([
    terminal("jjui - /src/unmapped", { mapped: false, at: [-300, 0] }),
    terminal("jjui - https://remote/repo", { at: [-200, 0] }),
    terminal("mattw@remote:/src/remote", { at: [-100, 0] }),
    terminal("mattw@mattarchy:/src/local"),
  ]);
  assert.equal(selectRepository(data, "DP-1"), "/src/local");
});

test("precedence transitions never retain an old label", () => {
  const data = snapshot([
    terminal("mattw@mattarchy:/src/focused"),
    terminal("jjui - /src/jjui", { address: "jjui" }),
    terminal("mattw@mattarchy:/src/fallback", { address: "fallback" }),
  ], { activeAddress: "shell" });
  assert.equal(selectRepository(data, "DP-1"), "/src/focused");
  data.clients[0].title = "no path";
  assert.equal(selectRepository(data, "DP-1"), "/src/jjui");
  data.clients.splice(1, 1);
  assert.equal(selectRepository(data, "DP-1"), "/src/fallback");
  data.clients = [];
  assert.equal(selectRepository(data, "DP-1"), "");
});

test("missing or malformed snapshots produce the blank state", () => {
  for (const data of [null, {}, { clients: [], monitors: [] }, snapshot([])]) {
    assert.equal(selectRepository(data, "DP-1"), "");
  }
});
