FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 生产运行配置：数据目录 + 监听地址
ENV DB_DIR=/app/data \
    HOST=0.0.0.0 \
    PORT=19000

# 先 COPY requirements 单独成层，利于缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码 + Alembic 迁移（app.main 启动时自动跑 alembic upgrade head）
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# 数据目录（docker-compose 会 bind mount 覆盖）
RUN mkdir -p /app/data

EXPOSE 19000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "19000"]
