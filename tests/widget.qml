import QtQuick
import QtQuick.Window
import Quickshell
import "plugin" as Plugin

ShellRoot {
  id: testRoot
  property int phase: 0
  property real collapsedWidth: 0

  function check(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  Window {
    visible: true
    width: 1200
    height: 30

    Plugin.BarWidget {
      id: widget
      expanded: false
      monitorName: "DP-1"
      snapshotScript: Quickshell.shellPath("snapshot.sh")
      width: implicitWidth
      height: implicitHeight
    }
  }

  Timer {
    interval: 300
    running: true
    repeat: true
    onTriggered: {
      try {
        if (testRoot.phase === 0) {
          testRoot.check(widget.path === "/home/mattw/src/project <literal>", "initial snapshot")
          testRoot.check(widget.directoryName === "project <literal>", "directory basename")
          testRoot.check(widget.visible && widget.implicitWidth > 0, "visible label")
          testRoot.collapsedWidth = widget.implicitWidth
          widget.expanded = true
          testRoot.check(widget.implicitWidth <= testRoot.collapsedWidth + 1, "expansion is animated")
        } else if (testRoot.phase === 1) {
          testRoot.check(widget.implicitWidth > testRoot.collapsedWidth, "inline hover expansion")
          widget.expanded = false
        } else if (testRoot.phase === 2) {
          testRoot.check(Math.abs(widget.implicitWidth - testRoot.collapsedWidth) < 1, "hover collapse")
          widget.monitorName = "DP-2"
        } else {
          testRoot.check(widget.path === "/srv/other", "monitor-specific workspace refresh")
          widget.applySnapshot("not-json")
          testRoot.check(!widget.visible && widget.implicitWidth === 0 && widget.implicitHeight === 0, "blank state removes all spacing")
          widget.applySnapshot(Quickshell.env("WORKSPACE_REPO_FIXTURE"))
          testRoot.check(widget.path === "/srv/other", "recover after malformed snapshot")
          widget.applySnapshot("{}")
          testRoot.check(widget.path === "" && !widget.visible, "no remembered label")
          console.log("workspace-repo widget smoke test passed")
          Qt.quit()
        }
        testRoot.phase += 1
      } catch (error) {
        console.error("workspace-repo widget smoke test failed: " + error)
        Qt.exit(1)
      }
    }
  }
}
