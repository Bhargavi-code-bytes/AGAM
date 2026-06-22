#!/bin/zsh
set -euo pipefail

AGENT_ID="com.agam.multiuser"
PLIST_PATH="$HOME/Library/LaunchAgents/${AGENT_ID}.plist"
START_SCRIPT="/Users/vn593ms/Documents/AGAM/multiuser/start_server.sh"
LOG_DIR="$HOME/Library/Logs"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AGENT_ID}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>${START_SCRIPT}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>/Users/vn593ms/Documents/AGAM/multiuser</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/agam-multiuser.out.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/agam-multiuser.err.log</string>
</dict>
</plist>
PLIST

chmod +x "$START_SCRIPT"

launchctl bootout "gui/$(id -u)/${AGENT_ID}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/${AGENT_ID}"
launchctl kickstart -k "gui/$(id -u)/${AGENT_ID}"

echo "Autostart installed: ${AGENT_ID}"
echo "Plist: $PLIST_PATH"
echo "App URL: http://localhost:8091"
