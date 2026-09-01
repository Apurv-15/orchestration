# Multi-stage Dockerfile for Orchnex Hugging Face Space
# 1. Build Next.js frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# 2. Production Python runtime
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.text .
RUN pip install --no-cache-dir -r requirements.text uvicorn

# Copy application source
COPY . .

# Copy built frontend
COPY --from=frontend-builder /app/frontend/.next /app/frontend/.next
COPY --from=frontend-builder /app/frontend/node_modules /app/frontend/node_modules

# Expose default HF Spaces port
EXPOSE 7860

# Script to launch both backend and frontend
CMD ["sh", "-c", "uvicorn server.py:app --host 0.0.0.0 --port 8000 & cd frontend && npm start -- -p 7860"]
