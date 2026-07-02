FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/signal-service /app/backend/signal-service
COPY backend/local_db_helper.py /app/backend/local_db_helper.py

EXPOSE 8003

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.signal-service.app.main:app", "--host", "0.0.0.0", "--port", "8003"]
