FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# CloudBase Cloud Run injects PORT env var; default 8000 for local dev
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
