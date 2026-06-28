#!/bin/bash
set -e

MESSAGE="${1:-OTA 업데이트}"

echo "▶ EAS Android APK 빌드 시작..."
eas build --platform android --profile preview --non-interactive

echo ""
echo "▶ OTA 업데이트 배포 시작..."
eas update --branch production --message "$MESSAGE" --non-interactive

echo ""
echo "✅ 빌드 + OTA 배포 완료"
