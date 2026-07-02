FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy gateway and local helper
COPY backend/api-gateway /app/backend/api-gateway
COPY backend/local_db_helper.py /app/backend/local_db_helper.py

# Copy internal service dependencies that gateway imports
COPY backend/backtesting-service /app/backend/backtesting-service
COPY backend/portfolio-service /app/backend/portfolio-service

EXPOSE 8005

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.api-gateway.app.main:app", "--host", "0.0.0.0", "--port", "8005"]
