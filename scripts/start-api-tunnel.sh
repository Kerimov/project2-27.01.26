#!/usr/bin/env bash
# Публикует локальный Next.js (порт 3000) по HTTPS для Expo Go на iPhone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CF="$ROOT/scripts/bin/cloudflared"
LOG="/tmp/pma-cloudflared.log"
ENV_FILE="$ROOT/mobile-android/.env.local"

if [[ ! -x "$CF" ]]; then
  echo "cloudflared не найден. Скачайте: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

pkill -f "cloudflared tunnel --url http://127.0.0.1:3000" 2>/dev/null || true
: > "$LOG"
"$CF" tunnel --url http://127.0.0.1:3000 >>"$LOG" 2>&1 &
sleep 5
URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1)"
if [[ -z "$URL" ]]; then
  echo "Не удалось получить URL туннеля. Лог: $LOG"
  exit 1
fi

cat > "$ENV_FILE" <<EOF
# Автогенерация: scripts/start-api-tunnel.sh
EXPO_PUBLIC_API_BASE_URL=$URL
EOF

echo "API tunnel: $URL"
echo "Записано в mobile-android/.env.local"
echo "Перезапустите Expo: cd mobile-android && npx expo start --clear"
