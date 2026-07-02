FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ai-prediction-service /app/backend/ai-prediction-service
COPY backend/local_db_helper.py /app/backend/local_db_helper.py
COPY ml /app/ml

EXPOSE 8006

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.ai-prediction-service.app.main:app", "--host", "0.0.0.0", "--port", "8006"]
