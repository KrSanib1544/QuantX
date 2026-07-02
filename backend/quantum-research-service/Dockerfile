FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/quantum-research-service /app/backend/quantum-research-service
COPY backend/local_db_helper.py /app/backend/local_db_helper.py

EXPOSE 8007

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.quantum-research-service.app.main:app", "--host", "0.0.0.0", "--port", "8007"]
