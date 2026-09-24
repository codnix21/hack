FROM python:3.12-slim-bookworm

WORKDIR /app

# psycopg2-binary — без gcc/libpq-dev.
# fonts-dejavu-core — кириллица в PDF (reportlab).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      -o Acquire::Retries=5 \
      -o Acquire::http::Timeout=30 \
      fonts-dejavu-core; \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x /app/entrypoint.sh

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["/app/entrypoint.sh"]
