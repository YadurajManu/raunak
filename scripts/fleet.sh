#!/usr/bin/env bash
set -euo pipefail

HOST="${FLEET_HOST:-fleet-cp}"
REMOTE_DIR="${FLEET_DIR:-/opt/raunak}"

echo "========================================="
echo " Deploying Raunak to ${HOST}:${REMOTE_DIR}"
echo "========================================="

echo "==> 1. Archiving and extracting latest committed code..."
git archive HEAD | ssh "${HOST}" "tar -x -C ${REMOTE_DIR}"

echo "==> 2. Building web container on server..."
ssh "${HOST}" "cd ${REMOTE_DIR} && docker compose --env-file .env -f deploy/compose.yml build web"

echo "==> 3. Running database migrations..."
ssh "${HOST}" "cd ${REMOTE_DIR} && docker compose --env-file .env -f deploy/compose.yml run --rm web pnpm db:migrate"

echo "==> 4. Restarting web and worker services..."
ssh "${HOST}" "cd ${REMOTE_DIR} && docker compose --env-file .env -f deploy/compose.yml up -d web worker"

echo "==> 5. Verifying container health..."
ssh "${HOST}" "cd ${REMOTE_DIR} && docker compose --env-file .env -f deploy/compose.yml ps"

echo "========================================="
echo " Deployment to ${HOST} completed successfully!"
echo " Live site: https://raunak.yaduraj.me"
echo "========================================="
