FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/portfolio-service /app/backend/portfolio-service
COPY backend/local_db_helper.py /app/backend/local_db_helper.py
COPY backend/risk-service /app/backend/risk-service

EXPOSE 8004

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.portfolio-service.app.main:app", "--host", "0.0.0.0", "--port", "8004"]
