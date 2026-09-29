FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY . .
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "exec uvicorn api.api_server:app --host 0.0.0.0 --port ${PORT:-8000}"]
