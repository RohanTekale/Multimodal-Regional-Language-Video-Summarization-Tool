FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
COPY input/ ./input/
COPY output/ ./output/
COPY static/ ./static/
COPY video_ids.json ./video_ids.json
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]