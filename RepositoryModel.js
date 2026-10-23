// Plain JavaScript shared by the QML namespace and Node's test runner.
function parseTitle(title, context) {
  if (typeof title !== "string" || /[\x00-\x1f\x7f]/.test(title)) {
    return "";
  }

  var path = title.indexOf("jjui - ") === 0 ? title.slice(7) : title;
  var shell = /^[^\s@:/]+@([^\s@:/]+):(.*)$/.exec(path);
  if (shell) {
    var host = String(context.host || "").toLowerCase();
    var titleHost = shell[1].toLowerCase();
    if (!host || (titleHost !== host && titleHost !== host.split(".")[0])) {
      return "";
    }
    path = shell[2];
  }

  if (path === "~" || path.indexOf("~/") === 0) {
    if (!context.home || context.home[0] !== "/") {
      return "";
    }
    path = context.home.replace(/\/+$/, "") + path.slice(1);
  }
  if (path[0] !== "/" || path.indexOf("//") === 0 || path.indexOf("://") !== -1) {
    return "";
  }
  return path.replace(/\/+$/, "") || "/";
}

function isTerminal(client) {
  var tags = client.tags || [];
  return tags.some(function(tag) { return /^terminal\*?$/.test(tag); })
    || /^(foot(client|-client)?|alacritty|org\.alacritty\.alacritty|kitty|ghostty|com\.mitchellh\.ghostty|wezterm|org\.wezfurlong\.wezterm|org\.gnome\.terminal|org\.kde\.konsole|xterm|urxvt|st)$/i.test(client.class || "");
}

function selectRepository(snapshot, monitorName) {
  if (!snapshot || !Array.isArray(snapshot.monitors) || !Array.isArray(snapshot.clients)) {
    return "";
  }
  var monitor = snapshot.monitors.find(function(item) { return item.name === monitorName; });
  if (!monitor) {
    return "";
  }
  var workspace = monitor.specialWorkspace && monitor.specialWorkspace.id
    ? monitor.specialWorkspace : monitor.activeWorkspace;
  if (!workspace) {
    return "";
  }

  var candidates = snapshot.clients.filter(function(client) {
    return client.mapped !== false && client.workspace && client.workspace.id === workspace.id
      && isTerminal(client);
  }).map(function(client, index) {
    return { client: client, path: parseTitle(client.title, snapshot), index: index };
  }).filter(function(item) {
    return item.path;
  });
  var focused = candidates.find(function(item) {
    return snapshot.activeAddress && item.client.address === snapshot.activeAddress;
  });
  if (focused) {
    return focused.path;
  }

  candidates.sort(function(left, right) {
    return left.client.at[0] - right.client.at[0]
      || left.client.at[1] - right.client.at[1]
      || left.index - right.index;
  });
  var fallback = candidates.find(function(item) {
    return item.client.title.indexOf("jjui - ") === 0;
  }) || candidates.find(function(item) {
    return /^[^\s@:/]+@[^\s@:/]+:/.test(item.client.title);
  });
  return fallback ? fallback.path : "";
}
