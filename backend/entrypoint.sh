#!/bin/sh
set -e

echo "Waiting for database..."
i=0
until python -c "import os,psycopg2; psycopg2.connect(os.environ['DATABASE_URL']).close()" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not ready after 30 attempts"
    exit 1
  fi
  sleep 2
done
echo "Database is ready"

alembic upgrade head || true
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
