# Workspace repository

An Omarchy bar widget showing the current workspace's terminal directory. Hover
over the directory name to smoothly expand it to the full path inside the bar.

## Installation

Requires Omarchy's Quickshell bar (tested on 4.0.6).

```bash
omarchy plugin add https://github.com/mwinckler/mattw.workspace-repo --enable
```

To place it beside the workspace indicators:

```bash
omarchy bar move mattw.workspace-repo --after omarchy.workspaces
```

## Title selection

Each bar labels its own monitor's displayed workspace, in this order:

1. The focused terminal's local title path, if it belongs to this workspace.
2. The leftmost terminal with a usable `jjui - <path>` title.
3. The leftmost terminal with a usable `<user>@<local-host>:<path>` title,
   including ordinary shells and Neovim.
4. Otherwise, hide the widget and its spacing.

Leftmost means lowest X coordinate, including off-screen windows. Ties use Y,
then snapshot order. Unmapped windows are excluded. An open special workspace
takes precedence over the monitor's regular workspace.

### Supported titles

- `user@hostname:~/src/project`
- `jjui - /home/user/src/project`
- `/tmp/project` (focused terminal only)

Absolute paths, `~`, `~/…`, spaces, and trailing slashes are supported. Shell
titles must name the local host (short or full hostname, case-insensitive).
Remote-host paths, URLs, relative paths, bare project names, and control
characters are ignored. Only terminal windows qualify, identified by common
app IDs or Hyprland's `terminal`/`terminal*` tag.

Home and non-repository directories qualify. Paths come directly from titles:
there are no repository-root searches, process inspection, remembered labels,
or shell hooks.

## Tests

```bash
node --test tests/*.test.js
qmllint BarWidget.qml
bash -n snapshot.sh
```

The QML smoke test runs off-screen and requires Omarchy.
