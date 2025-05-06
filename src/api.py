from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from src.important_video import ImportantVideo
from src.config import Config
import os
import logging
import shutil
import json
import threading
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("VideoProcessorAPI")

app = FastAPI(
    title="Video Summarizer API",
    description="API to summarize videos with Hindi narration",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/output", StaticFiles(directory="output"), name="output")
logger.info("Mounted /static and /output directories")

id_lock = threading.Lock()
VIDEO_IDS_FILE = "video_ids.json"

def load_video_id_counter():
    if os.path.exists(VIDEO_IDS_FILE):
        with open(VIDEO_IDS_FILE, 'r') as f:
            data = json.load(f)
            return data.get("last_id", 0)
    return 0

def save_video_id_counter(counter):
    with open(VIDEO_IDS_FILE, 'w') as f:
        json.dump({"last_id": counter}, f)

video_id_counter = load_video_id_counter()

class SummarizeRequest(BaseModel):
    lang: str = Config.DEFAULT_LANG
    num_scenes: int = Config.DEFAULT_NUM_SCENES
    downscale: int = Config.DEFAULT_DOWNSCALE
    tts_speed: float = Config.DEFAULT_TTS_SPEED

@app.get("/dashboard/")
async def get_dashboard():
    logger.info("Serving dashboard")
    return FileResponse("static/dashboard.html")

@app.post("/summarize/")
async def summarize_video(
    file: UploadFile = File(...),
    lang: str = Config.DEFAULT_LANG,
    num_scenes: int = Config.DEFAULT_NUM_SCENES,
    downscale: int = Config.DEFAULT_DOWNSCALE,
    tts_speed: float = Config.DEFAULT_TTS_SPEED
):
    global video_id_counter
    try:
        with id_lock:
            video_id_counter += 1
            video_id = video_id_counter
            save_video_id_counter(video_id_counter)

        unique_input_filename = f"video_{video_id}.mp4"
        unique_output_dir = f"output/{video_id}"

        input_dir = "input"
        os.makedirs(input_dir, exist_ok=True)
        input_path = os.path.join(input_dir, unique_input_filename)
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        processor = ImportantVideo(input_path, lang=lang, num_scenes=num_scenes, tts_speed=tts_speed)
        logger.info(f"Processing video: {file.filename} as {unique_input_filename} with video_id: {video_id}")
        processor.downscale(downscale)
        processor.detect_scenes()
        processor.top_scenes()
        transcripts = processor.convert_clips_to_text(unique_output_dir)
        audio_paths = processor.text_to_speech(transcripts, unique_output_dir)
        merged_clips = processor.merge_audio_with_clips(audio_paths, unique_output_dir)
        processor.merge_all_clips(merged_clips, unique_output_dir)

        output_path = os.path.join(unique_output_dir, Config.FINAL_OUTPUT)
        if not os.path.exists(output_path):
            logger.error(f"Final video not found at {output_path}")
            raise HTTPException(status_code=500, detail="Failed to generate summarized video")

        logger.info(f"Generated final video: {output_path} for video_id: {video_id}")
        return {"output_path": output_path, "video_id": str(video_id)}

    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/{video_id}")
async def get_analytics(video_id: str):
    if not video_id.isdigit():
        logger.error(f"Invalid video_id: {video_id}. Must be numeric.")
        raise HTTPException(status_code=400, detail="Video ID must be numeric")

    analytics_path = f"output/{video_id}/analytics.json"
    logger.info(f"Fetching analytics from: {analytics_path}")
    if not os.path.exists(analytics_path):
        logger.error(f"Analytics file not found for video_id: {video_id}")
        raise HTTPException(status_code=404, detail="Analytics data not found")

    try:
        with open(analytics_path, 'r') as f:
            analytics_data = json.load(f)
        logger.info(f"Successfully retrieved analytics for video_id: {video_id}")
        return analytics_data
    except Exception as e:
        logger.error(f"Error reading analytics for video_id {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")

@app.get("/output/{path:path}")
async def serve_output_file(path: str):
    file_path = os.path.join("output", path)
    logger.info(f"Serving output file: {file_path}")
    if not os.path.exists(file_path):
        logger.error(f"Output file not found: {file_path}")
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)