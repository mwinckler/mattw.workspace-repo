import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "RepositoryModel.js" as RepositoryModel

BarWidget {
  id: root
  moduleName: "mattw.workspace-repo"

  property string path: ""
  property bool expanded: hover.hovered
  property bool refreshPending: false
  property string monitorName: root.QsWindow.window && root.QsWindow.window.screen
    ? root.QsWindow.window.screen.name : ""
  property string snapshotScript: Quickshell.env("HOME") + "/.config/omarchy/plugins/mattw.workspace-repo/snapshot.sh"

  readonly property string directoryName: path === "/" ? "/" : path.slice(path.lastIndexOf("/") + 1)
  property real labelWidth: (expanded ? label.implicitWidth : nameMetrics.advanceWidth) + Style.space(16)

  function refresh() {
    if (queryProc.running) {
      refreshPending = true
      return
    }
    refreshPending = false
    queryProc.running = true
    stallTimer.restart()
  }

  function applySnapshot(raw) {
    try {
      root.path = RepositoryModel.selectRepository(JSON.parse(raw), root.monitorName)
    } catch (error) {
      root.path = ""
    }
  }

  onMonitorNameChanged: {
    root.path = ""
    refreshTimer.start()
  }
  Component.onCompleted: refreshTimer.start()

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event && /^(workspace(v2)?|activewindow(v2)?|focusedmon|openwindow|closewindow|movewindow(v2)?|windowtitle(v2)?|activespecial(v2)?|moveworkspace(v2)?|monitoradded(v2)?|monitorremoved|configreloaded|changefloatingmode|togglegroup|moveintogroup|moveoutofgroup|pin|fullscreen(v2)?)$/.test(event.name)) {
        refreshTimer.start()
      }
    }
  }

  Timer {
    id: refreshTimer
    interval: 50
    onTriggered: root.refresh()
  }

  Process {
    id: queryProc
    command: ["bash", root.snapshotScript]
    stdout: StdioCollector { id: snapshotOutput }
    onExited: function(exitCode) {
      stallTimer.stop()
      root.applySnapshot(exitCode === 0 ? snapshotOutput.text : "")
      if (root.refreshPending) {
        refreshTimer.start()
      }
    }
  }

  Timer {
    id: stallTimer
    interval: 5000
    onTriggered: {
      root.path = ""
      queryProc.running = false
    }
  }

  // Scrolling layout reorders need not emit a window-move event.
  Timer {
    interval: 1000
    running: true
    repeat: true
    onTriggered: root.refresh()
  }

  visible: path !== ""
  implicitWidth: visible ? (vertical ? barSize : labelWidth) : 0
  implicitHeight: visible ? (vertical ? labelWidth : barSize) : 0

  Behavior on labelWidth {
    NumberAnimation { duration: 180; easing.type: Easing.OutCubic }
  }

  TextMetrics {
    id: nameMetrics
    font: label.font
    text: root.directoryName
  }

  // Right anchoring keeps the basename visible while revealing its prefix.
  Item {
    anchors.centerIn: parent
    width: Math.max(0, (root.vertical ? root.height : root.width) - Style.space(16))
    height: root.barSize
    rotation: root.vertical ? -90 : 0
    clip: true

    Text {
      id: label
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      text: root.path
      textFormat: Text.PlainText
      color: root.bar ? root.bar.barForeground : Commons.Color.foreground
      font.family: root.bar ? root.bar.fontFamily : Style.font.family
      font.pixelSize: Style.font.body
      renderType: Text.NativeRendering
    }
  }

  HoverHandler { id: hover }
}
