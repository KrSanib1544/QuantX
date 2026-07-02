FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/market-data-service /app/backend/market-data-service
COPY backend/local_db_helper.py /app/backend/local_db_helper.py

EXPOSE 8001

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.market-data-service.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
