Video Summarizer

A tool to summarize videos by detecting key scenes, transcribing audio, generating Hindi narration, and merging them into a final video. Built with FastAPI, SceneDetect, Whisper Tiny, Google Translator, gTTS, and FFmpeg, this project enhances video accessibility for regional audiences in India by translating English narration to Hindi.
Published in [Journal Name] (DOI: 10.22399/ijcesen.XXXXXX).
Table of Contents

Project Overview
Features
System Architecture
Technologies Used
Setup
Usage
Contributing
License
Authors
References

Project Overview
Videos are a key medium for communication, education, and entertainment, but language barriers and lengthy durations can limit accessibility, especially in multilingual regions like India. The Video Summarizer addresses this by:

Extracting key scenes using SceneDetect.
Transcribing English audio with Whisper Tiny ASR.
Translating transcripts to Hindi via Google Translator.
Generating synthetic Hindi narration with gTTS.
Synchronizing audio and video with FFmpeg.

Powered by FastAPI and containerized with Docker, the tool processes .mp4 and .avi videos efficiently, promoting inclusivity for Hindi-speaking audiences in sectors like education, media, and journalism.
Features

Video Summarization: Creates concise videos by selecting key scenes.
Audio Transcription: Converts English audio to text with high accuracy.
Text Translation: Translates English to Hindi while preserving context.
Synthetic Speech: Produces natural-sounding Hindi narration.
Audio-Video Sync: Seamlessly integrates audio with summarized video.
Scalable API: FastAPI backend for efficient processing.
Containerized Deployment: Dockerized for easy setup and portability.

System Architecture
The pipeline processes videos through these stages:

Input: Accepts .mp4 or .avi files via FastAPI.
Scene Detection: Uses SceneDetect for frame histogram-based scene extraction.
Audio Transcription: Transcribes English audio with Whisper Tiny.
Translation: Converts transcripts to Hindi using Google Translator.
Speech Synthesis: Generates Hindi audio with gTTS.
Synchronization: Merges audio and video with FFmpeg.
Output: Delivers a summarized video with Hindi narration.

Note: Replace the placeholder with an actual diagram if available.
Technologies Used

Python 3.8+: Core programming language.
FastAPI: API framework for scalable video processing.
SceneDetect: Scene change detection.
Whisper Tiny: Lightweight ASR for transcription.
Google Translator: Neural machine translation (English to Hindi).
gTTS: Text-to-speech for Hindi narration.
FFmpeg: Audio-video synchronization and merging.
Docker: Containerization for deployment.
Dependencies: Listed in requirements.txt.

Setup
Follow these steps to set up the project using Docker:
Prerequisites

Docker: Install from Docker's official site.
Docker Compose: Included with Docker Desktop or install separately.
Verify installation:docker --version
docker-compose --version


Git

Steps

Clone the Project:
git clone https://github.com/your-username/video-summarizer.git
cd video-summarizer


Configure Environment (if needed):

Create a .env file in the root directory for API keys (e.g., Google Translator):GOOGLE_TRANSLATOR_API_KEY=your-api-key


Update docker-compose.yml if custom configurations are required.


Build and Run with Docker Compose:
docker-compose up --build

This builds the Docker image and starts the FastAPI server. Access at http://localhost:8000.

Stop the Containers:
docker-compose down



Local Setup (Optional)
For non-Docker setup:

Create a virtual environment:python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate


Install dependencies:pip install -r requirements.txt


Install FFmpeg:
Ubuntu: sudo apt-get install ffmpeg
macOS: brew install ffmpeg
Windows: Download from FFmpeg website and add to PATH.


Run the server:uvicorn main:app --reload



Usage

Start the FastAPI Server:

With Docker: docker-compose up
Locally: uvicorn main:app --reload


Upload a Video:

Use the /upload endpoint to submit a .mp4 or .avi file.
Example with curl:curl -X POST "http://localhost:8000/upload" -F "file=@path/to/video.mp4"




Retrieve Summarized Video:

Access the output via /download or check the output/ directory (mapped as a Docker volume).


API Documentation:

Explore endpoints at http://localhost:8000/docs (Swagger UI).



Example
curl -X POST "http://localhost:8000/upload" -F "file=@sample_video.mp4"

Output: Summarized video with Hindi narration in output/summarized_video.mp4.
Contributing
Contributions are welcome! To contribute:

Fork the repository.
Create a branch (git checkout -b feature/your-feature).
Commit changes (git commit -m "Add your feature").
Push to the branch (git push origin feature/your-feature).
Open a Pull Request with a detailed description.

A
