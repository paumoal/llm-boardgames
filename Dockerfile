# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + compiled frontend
FROM python:3.12-slim
WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy compiled frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PORT=10000
EXPOSE 10000

CMD ["gunicorn", "--chdir", "backend", "app:app", "--bind", "0.0.0.0:10000", "--workers", "2", "--timeout", "120"]
