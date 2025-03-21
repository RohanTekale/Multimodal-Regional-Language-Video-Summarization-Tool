from fastapi import FastAPI, UploadFile, File, HTTPException
from src.important_video import ImportantVideo
from src.config import Config
import os
import logging
import shutil
import time

# Configure logging
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

@app.post("/summarize/", 
    summary="Summarize a video with Hindi narration",
    response_description="Path to the summarized video"
)
async def summarize_video(
    file: UploadFile = File(..., description="Video file to summarize"),
    lang: str = Config.DEFAULT_LANG,
    num_scenes: int = Config.DEFAULT_NUM_SCENES,
    downscale: int = Config.DEFAULT_DOWNSCALE,
    tts_speed: float = Config.DEFAULT_TTS_SPEED
):
    """
    Upload a video file, process it to extract key scenes, generate Hindi narration,
    and return the path to the summarized video.

    - **file**: The video file to process (e.g., MP4).
    - **lang**: Language for narration (default: 'hi' for Hindi).
    - **num_scenes**: Number of key scenes to include (default: 10).
    - **downscale**: Downscale factor for faster processing (default: 2).
    - **tts_speed**: Speed of text-to-speech (default: 1.0).
    """
    try:
        # Create unique input/output paths
        timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
        base_filename = os.path.splitext(file.filename)[0]
        unique_input_filename = f"{timestamp}_{base_filename}.mp4"
        unique_output_dir = f"output/{timestamp}_{base_filename}"

        input_dir = "input"
        os.makedirs(input_dir, exist_ok=True)
        input_path = os.path.join(input_dir, unique_input_filename)
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Initialize processor with unique output directory
        processor = ImportantVideo(input_path, lang=lang, num_scenes=num_scenes, tts_speed=tts_speed)
        
        # Process video
        logger.info(f"Processing video: {file.filename} as {unique_input_filename}")
        processor.downscale(downscale)
        processor.detect_scenes()
        processor.top_scenes()
        transcripts = processor.convert_clips_to_text(unique_output_dir)
        audio_paths = processor.text_to_speech(transcripts, unique_output_dir)
        if not audio_paths:
            logger.warning("No audio files generated; proceeding with video-only clips")
        merged_clips = processor.merge_audio_with_clips(audio_paths, unique_output_dir)
        if not merged_clips:
            logger.error("No clips merged; check merging step")
            raise ValueError("No clips merged")
        processor.merge_all_clips(merged_clips, unique_output_dir)
        
        output_path = os.path.join(unique_output_dir, Config.FINAL_OUTPUT)
        if not os.path.exists(output_path):
            logger.error("Final video not found after processing")
            raise HTTPException(status_code=500, detail="Failed to generate summarized video")
        
        logger.info(f"Returning output path: {output_path}")
        return {"output_path": output_path}
    
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Optionally keep input file; remove if cleanup desired
        pass  # if os.path.exists(input_path): os.remove(input_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)