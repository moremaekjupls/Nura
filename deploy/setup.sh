#!/usr/bin/env bash
# One-time server setup for Nura on Oracle Cloud (Ubuntu 22.04/24.04, ARM or x86).
# Run on the server:  curl -fsSL https://raw.githubusercontent.com/moremaekjupls/Nura/main/deploy/setup.sh | bash
set -euo pipefail

REPO="${REPO:-https://github.com/moremaekjupls/Nura.git}"
BRANCH="${BRANCH:-main}"
DIR="${DIR:-$HOME/nura}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

if ! grep -qi ubuntu /etc/os-release; then
  echo "Этот скрипт рассчитан на Ubuntu. Создайте инстанс с образом Canonical Ubuntu." >&2
  exit 1
fi

say "Обновляю систему и ставлю git"
sudo apt-get -o DPkg::Lock::Timeout=600 update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600 install -y git curl ca-certificates iptables-persistent

if ! command -v docker >/dev/null 2>&1; then
  say "Ставлю Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

say "Открываю порты 80 и 443 в файрволе Ubuntu"
# Oracle's Ubuntu images ship iptables rules that REJECT everything but SSH.
# Insert ACCEPT rules above that REJECT (the VCN Security List must allow them too).
open_port() {
  local proto=$1 port=$2
  if ! sudo iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then
    local pos
    pos=$(sudo iptables -L INPUT --line-numbers | awk '/REJECT/ {print $1; exit}')
    if [ -n "$pos" ]; then
      sudo iptables -I INPUT "$pos" -p "$proto" --dport "$port" -j ACCEPT
    else
      sudo iptables -A INPUT -p "$proto" --dport "$port" -j ACCEPT
    fi
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 443
sudo netfilter-persistent save

# Small instances (1 GB, e.g. VM.Standard.E2.1.Micro) can run out of memory while building.
if [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 2000 ] && [ ! -f /swapfile ]; then
  say "Мало памяти — добавляю swap 2 ГБ"
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

say "Скачиваю код ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout "$BRANCH" && git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  cp deploy/.env.example .env
  chmod 600 .env
  IP=$(curl -fsS https://api.ipify.org || true)
  if [ -n "$IP" ]; then
    SSLIP="${IP//./-}.sslip.io"
    sed -i "s|^DOMAIN=.*|DOMAIN=$SSLIP|; s|^APP_URL=.*|APP_URL=https://$SSLIP|" .env
  fi
  ADMIN=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
  sed -i "s|^ADMIN_KEY=.*|ADMIN_KEY=$ADMIN|" .env
  say "Создан $DIR/.env (адрес: ${SSLIP:-впишите DOMAIN и APP_URL})"
  echo "Впишите ключи: nano $DIR/.env — затем запустите: bash $DIR/deploy/update.sh"
  exit 0
fi

say "Запускаю"
sudo docker compose up -d --build
sudo docker compose ps
echo
echo "Готово: $(grep '^APP_URL=' .env | cut -d= -f2)"
