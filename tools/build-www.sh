#!/bin/bash
# Assembles the static web app into www/ for Capacitor.
# (Keeps node_modules, tools, android, docs and icon sources out of the APK.)
set -e
cd "$(dirname "$0")/.."
rm -rf www
mkdir -p www/assets
cp -r index.html manifest.json sw.js css js icons www/
cp -r assets/audio assets/fonts www/assets/
# app icon sources (assets/*.png) are intentionally NOT shipped in the APK
echo "www/ assembled: $(du -sh www | cut -f1)"
