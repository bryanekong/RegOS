FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the backend services code into the monolithic wrapper container
COPY services /app/services

EXPOSE 8000

# Start the Python monolithic runner script
CMD ["python", "services/api/monolith.py"]
