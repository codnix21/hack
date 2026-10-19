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

# Воспроизводимая установка ezdxf из offline wheels (если нет в образе).
# Не отключает TLS; не ходит в PyPI при наличии /wheels.
WHEELS_DIR="${EZDXF_WHEELS_DIR:-/wheels}"
if ! python -c "import ezdxf" 2>/dev/null; then
  if [ -d "$WHEELS_DIR" ] && ls "$WHEELS_DIR"/*.whl >/dev/null 2>&1; then
    echo "ezdxf missing — installing from $WHEELS_DIR (offline)"
    pip install --no-index --find-links="$WHEELS_DIR" "ezdxf==1.3.5"
  else
    echo "WARNING: ezdxf not installed and no wheels in $WHEELS_DIR — DXF preview unavailable"
  fi
fi
if python -c "import ezdxf; print('ezdxf', ezdxf.__version__)" 2>/dev/null; then
  :
else
  echo "WARNING: ezdxf still unavailable after install attempt"
fi

alembic upgrade head || true
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
