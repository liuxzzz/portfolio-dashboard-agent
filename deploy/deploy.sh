#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/maomao-youshu}"
COMPOSE_FILE="$DEPLOY_DIR/compose.prod.yaml"
ENV_FILE="$DEPLOY_DIR/.env"
IMAGE_REPOSITORY="${1:-}"
NEW_TAG="${2:-}"
PULL_MODE="${3:-pull}"
CURRENT_TAG_FILE="$DEPLOY_DIR/.current-image-tag"
BACKUP_DIR="$DEPLOY_DIR/backups"

if [[ -z "$IMAGE_REPOSITORY" || -z "$NEW_TAG" ]]; then
  echo "usage: deploy.sh <image-repository> <image-tag> [--skip-pull]" >&2
  exit 2
fi

if [[ "$PULL_MODE" != "pull" && "$PULL_MODE" != "--skip-pull" ]]; then
  echo "invalid pull mode" >&2
  exit 2
fi

if [[ ! "$NEW_TAG" =~ ^[a-zA-Z0-9._-]{7,128}$ ]]; then
  echo "invalid image tag" >&2
  exit 2
fi

if [[ ! -f "$COMPOSE_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "missing $COMPOSE_FILE or $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

exec 9>"$DEPLOY_DIR/.deploy.lock"
flock 9

export API_IMAGE="$IMAGE_REPOSITORY"
export IMAGE_TAG="$NEW_TAG"

COMPOSE=(
  docker compose
  --project-directory "$DEPLOY_DIR"
  --env-file "$ENV_FILE"
  --file "$COMPOSE_FILE"
)

PREVIOUS_TAG=""
if [[ -f "$CURRENT_TAG_FILE" ]]; then
  PREVIOUS_TAG="$(<"$CURRENT_TAG_FILE")"
fi

if [[ "$PULL_MODE" == "pull" ]]; then
  "${COMPOSE[@]}" pull api migrate
fi
"${COMPOSE[@]}" up --detach postgres

if "${COMPOSE[@]}" ps --status running --services | grep -qx postgres; then
  BACKUP_FILE="$BACKUP_DIR/predeploy-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if "${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$BACKUP_FILE"; then
    chmod 600 "$BACKUP_FILE"
  else
    rm -f "$BACKUP_FILE"
  fi
fi

"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" up --detach --no-deps api

healthy=false
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:8787/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" == true ]]; then
  printf '%s\n' "$NEW_TAG" >"$CURRENT_TAG_FILE"
  echo "deployed $IMAGE_REPOSITORY:$NEW_TAG"
  exit 0
fi

echo "health check failed for $IMAGE_REPOSITORY:$NEW_TAG" >&2
"${COMPOSE[@]}" logs --tail 100 api >&2 || true

if [[ -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$NEW_TAG" ]]; then
  export IMAGE_TAG="$PREVIOUS_TAG"
  "${COMPOSE[@]}" up --detach --no-deps api
  echo "rolled API back to $IMAGE_REPOSITORY:$PREVIOUS_TAG" >&2
fi

exit 1
