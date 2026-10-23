#!/usr/bin/env bash
set -euo pipefail

# A single IPC batch; titles remain JSON data and never become shell commands.
snapshot=$(hyprctl --batch -j 'clients;monitors;activewindow')
jq -cs --arg home "$HOME" --arg host "$(hostname)" '
  {
    clients: (.[0] | map({address, class, tags, title, workspace, at, mapped})),
    monitors: (.[1] | map({name, activeWorkspace, specialWorkspace})),
    activeAddress: (.[2].address // ""),
    home: $home,
    host: $host
  }
' <<<"$snapshot"
