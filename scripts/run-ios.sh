#!/usr/bin/env bash
#
# run-ios.sh — Build and launch the Radius ("In The Mood") app on an iOS 26
# simulator.
#
# The app is a Next.js server app (API routes + in-memory store), wrapped in a
# native Capacitor WKWebView shell. The native app loads the running Next.js
# server at http://localhost:3000 (the iOS Simulator shares the macOS loopback,
# so localhost reaches the host). This keeps every API route and the in-memory
# store fully functional inside the simulator.
#
# Usage: ./scripts/run-ios.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

# Pick the first booted iOS 26.x simulator, else the first available iPhone on
# an iOS 26 runtime.
UDID="${RADIUS_SIM_UDID:-}"
if [ -z "$UDID" ]; then
  UDID="$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1 || true)"
fi
if [ -z "$UDID" ]; then
  UDID="$(xcrun simctl list devices available | awk '/-- iOS 26/{f=1} f&&/iPhone/{print; exit}' | grep -Eo '[0-9A-F-]{36}' | head -1)"
fi
if [ -z "$UDID" ]; then
  echo "No iOS 26 simulator found. Install one via Xcode > Settings > Components." >&2
  exit 1
fi
echo "Using simulator: $UDID"

APP_ID="com.radius.inthemood"
APP_PATH="$(pwd)/ios/build/sym/Debug-iphonesimulator/App.app"

# 1) Build the web app and start the production server (if not already up).
if ! curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
  echo "Building Next.js app..."
  npm run build
  echo "Starting Next.js server on :3000..."
  (npm run start >/tmp/radius-server.log 2>&1 &)
  echo "Waiting for server..."
  until curl -s -o /dev/null http://localhost:3000/; do sleep 1; done
fi
echo "Server is up."

# 2) Build the native iOS app for the simulator.
#    A target-based build with -sdk iphonesimulator is used (rather than a
#    -scheme build) because the Capacitor 8 SPM scheme's destination resolution
#    can fail to match a concrete simulator on this toolchain.
echo "Building iOS app..."
xcodebuild -project ios/App/App.xcodeproj -target App -configuration Debug \
  -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO \
  SYMROOT="$(pwd)/ios/build/sym" build

# 3) Boot, install, launch.
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || xcrun simctl boot "$UDID" || true
open -a Simulator
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch "$UDID" "$APP_ID"

echo "Launched $APP_ID on $UDID."
echo "If the first paint is blank, the WebKit GPU process is still warming up —"
echo "give it ~10s or relaunch; subsequent launches render immediately."
