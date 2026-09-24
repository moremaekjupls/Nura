#!/usr/bin/env bash
# Nura: create everything on Oracle Cloud from Cloud Shell, in one go.
#   curl -fsSL https://raw.githubusercontent.com/moremaekjupls/Nura/main/deploy/oci-launch.sh -o launch.sh && bash launch.sh
#
# Creates (or reuses) a VCN with a public subnet and ports 22/80/443 open, looks for a free
# Always Free ARM machine in every availability domain (falls back to the AMD Micro), and
# launches it with a boot script that installs Docker and starts Nura. Safe to re-run.
set -euo pipefail

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v oci >/dev/null || die "Запустите скрипт в Oracle Cloud Shell (значок >_ вверху консоли)."
command -v jq  >/dev/null || die "Нужен jq (в Cloud Shell он есть)."
C="${OCI_COMPARTMENT:-${OCI_TENANCY:-}}"
[ -n "$C" ] || die "Не найден OCI_TENANCY. Запустите в Cloud Shell."
NAME=nura

# --- already there? -------------------------------------------------------
EXISTING=$(oci compute instance list -c "$C" --display-name "$NAME" --lifecycle-state RUNNING --query 'data[0].id' --raw-output 2>/dev/null || true)
if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
  IP=$(oci compute instance list-vnics --instance-id "$EXISTING" --query 'data[0]."public-ip"' --raw-output)
  say "Машина уже создана: $IP  →  https://${IP//./-}.sslip.io"
  exit 0
fi

# --- secrets ---------------------------------------------------------------
echo "Ключи попадут только на ваш сервер (в файл .env). Пустое значение — пропустить."
read -rp "Telegram bot token: " BOT
read -rp "Gemini API key (распознавание еды): " GEMINI
read -rp "Resend API key (письма сброса пароля): " RESEND
[ -n "$BOT" ] || warn "Без токена бота не будет входа из Telegram и напоминаний — можно добавить позже."
ADMIN=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)

# --- network ---------------------------------------------------------------
say "Сеть"
VCN=$(oci network vcn list -c "$C" --display-name nura-vcn --query 'data[0].id' --raw-output 2>/dev/null || true)
if [ -z "$VCN" ] || [ "$VCN" = "null" ]; then
  VCN=$(oci network vcn create -c "$C" --display-name nura-vcn --cidr-blocks '["10.0.0.0/16"]' --dns-label nura \
        --wait-for-state AVAILABLE --query data.id --raw-output)
  IGW=$(oci network internet-gateway create -c "$C" --vcn-id "$VCN" --is-enabled true --display-name nura-igw \
        --wait-for-state AVAILABLE --query data.id --raw-output)
  RT=$(oci network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"' --raw-output)
  oci network route-table update --rt-id "$RT" --force \
    --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" >/dev/null
  echo "  VCN создана"
else
  echo "  VCN nura-vcn уже есть"
fi
SL=$(oci network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)
tcp() { printf '{"source":"0.0.0.0/0","protocol":"6","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":%s,"max":%s}}}' "$1" "$1"; }
oci network security-list update --security-list-id "$SL" --force \
  --ingress-security-rules "[$(tcp 22),$(tcp 80),$(tcp 443),{\"source\":\"0.0.0.0/0\",\"protocol\":\"1\",\"isStateless\":false,\"icmpOptions\":{\"type\":3,\"code\":4}},{\"source\":\"0.0.0.0/0\",\"protocol\":\"17\",\"isStateless\":false,\"udpOptions\":{\"destinationPortRange\":{\"min\":443,\"max\":443}}}]" \
  --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all","isStateless":false}]' >/dev/null
echo "  порты 22, 80, 443 открыты"
SUBNET=$(oci network subnet list -c "$C" --vcn-id "$VCN" --display-name nura-public --query 'data[0].id' --raw-output 2>/dev/null || true)
if [ -z "$SUBNET" ] || [ "$SUBNET" = "null" ]; then
  SUBNET=$(oci network subnet create -c "$C" --vcn-id "$VCN" --display-name nura-public --cidr-block 10.0.0.0/24 \
           --dns-label pub --wait-for-state AVAILABLE --query data.id --raw-output)
fi
echo "  публичная подсеть готова"

# --- SSH key (kept in Cloud Shell) ----------------------------------------
[ -f ~/.ssh/nura ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/nura -q

# --- first-boot script ----------------------------------------------------
USERDATA=$(mktemp)
cat > "$USERDATA" <<BOOT
#!/bin/bash
exec > /var/log/nura-setup.log 2>&1
set -x
# First boot: unattended-upgrades holds the apt lock for a few minutes — wait for it.
for _ in \$(seq 1 120); do
  pgrep -x unattended-upgr >/dev/null || fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
  sleep 5
done
command -v git >/dev/null || apt-get -o DPkg::Lock::Timeout=600 install -y git
IP=\$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)
HOST="\${IP//./-}.sslip.io"
sudo -u ubuntu git clone https://github.com/moremaekjupls/Nura.git /home/ubuntu/nura
cat > /home/ubuntu/nura/.env <<ENV
DOMAIN=\$HOST
APP_URL=https://\$HOST
TELEGRAM_BOT_TOKEN=$BOT
GEMINI_API_KEY=$GEMINI
RESEND_API_KEY=$RESEND
MAIL_FROM=Nura <onboarding@resend.dev>
ADMIN_KEY=$ADMIN
ENV
chown ubuntu:ubuntu /home/ubuntu/nura/.env
chmod 600 /home/ubuntu/nura/.env
sudo -u ubuntu -H bash /home/ubuntu/nura/deploy/setup.sh
echo NURA_SETUP_DONE
BOOT

# --- find capacity --------------------------------------------------------
ADS=$(oci iam availability-domain list -c "$C" --query 'data[].name' --raw-output | jq -r '.[]')

image_for() {
  oci compute image list -c "$C" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
    --shape "$1" --sort-by TIMECREATED --sort-order DESC --limit 1 --query 'data[0].id' --raw-output
}

launch() { # shape ad [shape-config]
  local shape=$1 ad=$2 img out
  img=$(image_for "$shape")
  [ -n "$img" ] && [ "$img" != "null" ] || return 1
  local args=(compute instance launch -c "$C" --availability-domain "$ad" --shape "$shape" --image-id "$img"
              --subnet-id "$SUBNET" --assign-public-ip true --display-name "$NAME"
              --ssh-authorized-keys-file ~/.ssh/nura.pub --user-data-file "$USERDATA"
              --wait-for-state RUNNING --max-wait-seconds 900 --query data.id --raw-output)
  [ -n "${3:-}" ] && args+=(--shape-config "$3")
  if out=$(oci "${args[@]}" 2>&1); then
    INSTANCE=$(printf '%s\n' "$out" | grep -o 'ocid1\.instance[^" ]*' | tail -1)
    [ -n "$INSTANCE" ]
  else
    printf '%s\n' "$out" | grep -qi 'capacity' && echo "    нет мест" || { echo "    ошибка:"; printf '%s\n' "$out" | tail -5; }
    return 1
  fi
}

INSTANCE=""
say "Ищу свободную ARM-машину (VM.Standard.A1.Flex, 1 CPU / 6 GB)"
for ad in $ADS; do
  echo "  $ad"
  launch VM.Standard.A1.Flex "$ad" '{"ocpus":1,"memoryInGBs":6}' && break
done
if [ -z "$INSTANCE" ]; then
  say "ARM сейчас нет — беру AMD Micro (VM.Standard.E2.1.Micro, 1 GB)"
  for ad in $ADS; do
    echo "  $ad"
    launch VM.Standard.E2.1.Micro "$ad" && break
  done
fi
rm -f "$USERDATA"
[ -n "$INSTANCE" ] || die "Свободных бесплатных машин сейчас нет ни в одной зоне. Запустите скрипт ещё раз через 10–30 минут (или перейдите на Pay As You Go — это повышает шансы)."

IP=$(oci compute instance list-vnics --instance-id "$INSTANCE" --query 'data[0]."public-ip"' --raw-output)
URL="https://${IP//./-}.sslip.io"
say "Машина создана: $IP"
cat <<DONE

Сейчас она сама ставит Docker и собирает приложение: 5–15 минут.
Потом Nura откроется здесь:  $URL
Бот настроится сам (кнопка меню «Nura» в Telegram).

Следить за установкой:   ssh -i ~/.ssh/nura ubuntu@$IP 'tail -f /var/log/nura-setup.log'
Зайти на сервер:          ssh -i ~/.ssh/nura ubuntu@$IP
Ключ админа (сохраните):  $ADMIN
DONE
