#!/usr/bin/env bash
# Encrypted database backup. Dumps the app's schemas, encrypts the dump with
# age to a public key whose private half the team keeps offline, and uploads
# it to a private S3-compatible bucket (Cloudflare R2). The plain dump never
# touches the disk. Run daily by .github/workflows/backup.yml; restoring is
# described in docs/DEPLOY.md ("Backups").
#
# Needs pg_dump (same or newer major version than the server), age, and the
# AWS CLI for the upload. Environment:
#   BACKUP_DATABASE_URL    schema owner connection (Supabase: session pooler, port 5432)
#   BACKUP_AGE_RECIPIENT   age public key, "age1..."
#   BACKUP_S3_ENDPOINT     e.g. https://<account-id>.r2.cloudflarestorage.com
#   BACKUP_S3_BUCKET       e.g. record-backups
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY   a token that can write to that bucket
#   DATABASE_CA_CERT       optional: the server's CA certificate (PEM); turns on full verification
#   PG_DUMP                optional: path to pg_dump
#   BACKUP_OUTPUT_DIR      optional: keep the encrypted file here instead of uploading
set -euo pipefail

for v in BACKUP_DATABASE_URL BACKUP_AGE_RECIPIENT; do
  if [ -z "${!v:-}" ]; then echo "Missing $v" >&2; exit 1; fi
done
if [ -z "${BACKUP_OUTPUT_DIR:-}" ]; then
  for v in BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
    if [ -z "${!v:-}" ]; then echo "Missing $v" >&2; exit 1; fi
  done
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
if [ -n "${DATABASE_CA_CERT:-}" ]; then
  printf '%b\n' "$DATABASE_CA_CERT" > "$work/ca.crt"
  export PGSSLROOTCERT="$work/ca.crt" PGSSLMODE=verify-full
fi

name="record-$(date -u +%Y-%m-%dT%H%M%SZ).dump.age"
# Only the app's schemas (and the migration journal); the platform's own
# schemas are not ours to dump. Roles and their settings are recreated on restore.
"${PG_DUMP:-pg_dump}" --format=custom --no-owner \
  --schema=record --schema=record_public --schema=drizzle \
  --dbname="$BACKUP_DATABASE_URL" |
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$work/$name"

size=$(wc -c < "$work/$name")
if [ "$size" -lt 1024 ]; then echo "Backup is only $size bytes; something is wrong." >&2; exit 1; fi

if [ -n "${BACKUP_OUTPUT_DIR:-}" ]; then
  mkdir -p "$BACKUP_OUTPUT_DIR"
  mv "$work/$name" "$BACKUP_OUTPUT_DIR/$name"
  echo "Wrote $BACKUP_OUTPUT_DIR/$name ($size bytes)"
  exit 0
fi

# R2 speaks S3 with region "auto" and does not need the newer optional checksums.
AWS_DEFAULT_REGION=auto AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  aws s3 cp "$work/$name" "s3://$BACKUP_S3_BUCKET/$name" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
echo "Uploaded $name ($size bytes)"
