#!/usr/bin/env bash
# Pull the latest code and restart. Data lives in the nura-data volume and survives this.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"   # the server never has local code changes; .env is untracked and kept
sudo docker compose up -d --build --remove-orphans
sudo docker image prune -f >/dev/null
sudo docker compose ps
