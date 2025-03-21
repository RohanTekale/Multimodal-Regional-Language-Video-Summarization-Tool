from scenedetect import VideoManager, SceneManager, ContentDetector
import os
import logging
import time
import concurrent.futures
import argparse
from gtts import gTTS
import shutil
from src.utils import run_ffmpeg, safe_remove
from src.config import Config
import whisper
import numpy as np
import librosa
from deep_translator import GoogleTranslator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("VideoProcessor")

class ImportantVideo:
    def __init__(self, video_path: str, lang: str = Config.DEFAULT_LANG, num_scenes: int = Config.DEFAULT_NUM_SCENES, tts_speed: float = Config.DEFAULT_TTS_SPEED):
        logger.info(f"Initializing processor for video: {video_path}")
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        self.video_path = video_path
        self.lang = lang
        self.num_scenes = num_scenes
        self.tts_speed = tts_speed
        self.scenes_list = None
        self.summary_clips = None
        self.video_manager = VideoManager([video_path])
        self.scene_manager = SceneManager()
        self.scene_manager.add_detector(ContentDetector(threshold=30.0))
        self.whisper_model = whisper.load_model("base")
        self.translator = GoogleTranslator(source='en', target='hi')

    def downscale(self, factor: int = Config.DEFAULT_DOWNSCALE) -> None:
        if factor < 1:
            logger.warning(f"Invalid downscale factor: {factor}")
            raise ValueError("Downscale factor must be >= 1")
        logger.debug(f"Setting downscale factor to {factor}")
        self.video_manager.set_downscale_factor(factor)

    def detect_scenes(self) -> None:
        logger.info("Starting scene detection")
        start_time = time.time()
        try:
            self.video_manager.start()
            self.scene_manager.detect_scenes(frame_source=self.video_manager)
            self.scenes_list = self.scene_manager.get_scene_list()
            logger.info(f"Scene detection completed: found {len(self.scenes_list)} scenes in {time.time() - start_time:.2f} seconds")
            for i, (start, end) in enumerate(self.scenes_list, 1):
                logger.debug(f"Scene {i}: {start.get_seconds()}s - {end.get_seconds()}s")
        except Exception as e:
            logger.error(f"Error during scene detection: {str(e)}")
            raise
        finally:
            self.video_manager.release()

    def _extract_audio_energy(self, start_time: float, duration: float) -> float:
        temp_audio = f"temp_energy_{int(time.time())}.wav"
        try:
            cmd = [
                "ffmpeg", "-y",
                "-i", self.video_path,
                "-ss", str(start_time),
                "-t", str(duration),
                "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                temp_audio
            ]
            run_ffmpeg(cmd, "Audio energy extraction failed")
            audio, sr = librosa.load(temp_audio, sr=16000)
            rms = librosa.feature.rms(y=audio)[0].mean()
            return rms
        except Exception as e:
            logger.error(f"Error calculating audio energy: {str(e)}")
            return 0.0
        finally:
            safe_remove(temp_audio)

    def top_scenes(self) -> None:
        if not self.scenes_list:
            logger.error("No scenes detected before calling top_scenes()")
            raise ValueError("No scenes detected. Run detect_scenes() first.")
        
        logger.info(f"Selecting top {self.num_scenes} scenes with balanced duration and energy")
        scene_scores = []
        for start, end in self.scenes_list:
            duration = end.get_seconds() - start.get_seconds()
            if duration < 5.0:
                continue
            energy = self._extract_audio_energy(start.get_seconds(), duration)
            score = duration * (1.0 + energy)
            scene_scores.append((start, end, score))
        
        sorted_scenes = sorted(scene_scores, key=lambda x: x[2], reverse=True)
        self.summary_clips = [(s, e) for s, e, _ in sorted_scenes][:self.num_scenes]
        logger.debug(f"Selected {len(self.summary_clips)} scenes: {[f'{s.get_seconds()}-{e.get_seconds()}s' for s, e in self.summary_clips]}")

    def _process_scene(self, i: int, scene: tuple, text_dir: str) -> tuple:
        scene_start_time = scene[0].get_seconds() - 0.5
        scene_end_time = scene[1].get_seconds() + 0.5
        temp_audio = f"temp_audio_{i}_{int(time.time())}.wav"
        try:
            cmd = [
                "ffmpeg", "-y",
                "-i", self.video_path,
                "-ss", str(max(0, scene_start_time)),
                "-to", str(scene_end_time),
                "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                temp_audio
            ]
            run_ffmpeg(cmd, f"Audio extraction failed for scene {i}")
            if not os.path.exists(temp_audio) or os.path.getsize(temp_audio) == 0:
                logger.warning(f"Audio extraction failed for scene {i}")
                text = f"Scene {i} summary in Hindi"
            else:
                result = self.whisper_model.transcribe(temp_audio, language="en", fp16=False)
                text = result["text"].strip()
                logger.debug(f"Raw Whisper output for scene {i}: '{text}'")
                if not text:
                    logger.warning(f"No speech detected in scene {i}")
                    text = f"Scene {i} summary in Hindi"
                else:
                    text = self.translator.translate(text)
                    logger.info(f"Translated to Hindi for scene {i}: {text[:50]}...")
        
            transcript_path = os.path.join(text_dir, f"scene_{i}_transcript.txt")
            with open(transcript_path, 'w', encoding='utf-8') as f:
                f.write(text)
            logger.info(f"Transcribed scene {i}: {text[:50]}...")
            return (f"scene_{i}", text)
        except Exception as e:
            logger.error(f"Error processing scene {i}: {str(e)}")
            text = f"Scene {i} summary in Hindi"
            transcript_path = os.path.join(text_dir, f"scene_{i}_transcript.txt")
            with open(transcript_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return (f"scene_{i}", text)
        finally:
            safe_remove(temp_audio)

    def convert_clips_to_text(self, output_folder: str) -> dict:
        if not self.summary_clips:
            logger.error("No summary clips available for text conversion")
            raise ValueError("No summary clips available. Run top_scenes() first.")
        
        text_dir = os.path.join(output_folder, Config.OUTPUT_TRANSCRIPTS)
        os.makedirs(text_dir, exist_ok=True)
        
        logger.info("Starting audio-to-text conversion using Whisper sequentially")
        transcripts = {}
        for i, scene in enumerate(self.summary_clips, 1):
            scene_key, text = self._process_scene(i, scene, text_dir)
            transcripts[scene_key] = text
        
        logger.info(f"Transcription completed. Transcripts saved in {text_dir}")
        return transcripts

    def text_to_speech(self, transcripts: dict, output_folder: str) -> dict:
        audio_dir = os.path.join(output_folder, Config.OUTPUT_AUDIO)
        os.makedirs(audio_dir, exist_ok=True)
        
        audio_paths = {}
        logger.info(f"Converting transcripts to {self.lang} speech")
        for scene, text in transcripts.items():
            try:
                if not text.strip():
                    text = f"Scene {scene.split('_')[1]} summary in Hindi"
                logger.debug(f"Generating TTS for {scene}: {text}")
                tts = gTTS(text=text, lang=self.lang, slow=self.tts_speed < 1.0)
                audio_path = os.path.join(audio_dir, f"{scene}_{self.lang}.mp3")
                tts.save(audio_path)
                if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
                    logger.error(f"Failed to generate audio for {scene}: File missing or empty")
                    continue
                audio_paths[scene] = audio_path
                logger.info(f"Generated {self.lang} speech for {scene}")
            except Exception as e:
                logger.error(f"Error generating speech for {scene}: {str(e)}")
                text = f"Scene {scene.split('_')[1]} summary in Hindi"
                tts = gTTS(text=text, lang=self.lang, slow=self.tts_speed < 1.0)
                audio_path = os.path.join(audio_dir, f"{scene}_{self.lang}.mp3")
                tts.save(audio_path)
                if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
                    audio_paths[scene] = audio_path
                    logger.info(f"Generated fallback {self.lang} speech for {scene}")
        
        return audio_paths

    def _merge_clip(self, i: int, scene: tuple, audio_path: str, video_dir: str, video_name: str) -> str:
        scene_start_time = scene[0].get_seconds() - 0.5
        scene_end_time = scene[1].get_seconds() + 0.5
        output_clip = os.path.join(video_dir, f"{video_name}-scene-{i}.mp4")
        temp_video = f"temp_video_{i}_{int(time.time())}.mp4"
        
        try:
            cmd_extract = [
                "ffmpeg", "-y",
                "-i", self.video_path,
                "-ss", str(max(0, scene_start_time)),
                "-to", str(scene_end_time),
                "-c:v", "libx264", "-an",
                temp_video
            ]
            run_ffmpeg(cmd_extract, f"Video extraction failed for scene {i}")
            
            if audio_path and os.path.exists(audio_path):
                cmd_merge = [
                    "ffmpeg", "-y",
                    "-i", temp_video,
                    "-i", audio_path,
                    "-c:v", "copy", "-c:a", "aac",
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-shortest",
                    output_clip
                ]
                run_ffmpeg(cmd_merge, f"Audio merge failed for scene {i}")
                logger.info(f"Merged clip for scene {i} with audio")
            else:
                logger.warning(f"No audio for scene {i}, saving video only")
                shutil.move(temp_video, output_clip)
            
            return output_clip
        except Exception as e:
            logger.error(f"Error merging clip {i}: {str(e)}")
            if os.path.exists(temp_video):
                shutil.move(temp_video, output_clip)
            return output_clip
        finally:
            safe_remove(temp_video)

    def merge_audio_with_clips(self, audio_paths: dict, output_folder: str) -> list:
        video_dir = os.path.join(output_folder, Config.OUTPUT_VIDEO_CLIPS)
        os.makedirs(video_dir, exist_ok=True)
        
        merged_clips = []
        video_name = os.path.basename(self.video_path).split('.')[0]
        logger.info("Merging audio with video clips in parallel")
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(
                    self._merge_clip, i, scene, audio_paths.get(f"scene_{i}"), video_dir, video_name
                )
                for i, scene in enumerate(self.summary_clips, 1)
            ]
            merged_clips = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        logger.info(f"Merged {len(merged_clips)} clips")
        return merged_clips

    def merge_all_clips(self, merged_clips: list, output_folder: str) -> None:
        final_output = os.path.join(output_folder, Config.FINAL_OUTPUT)
        if not merged_clips:
            logger.error("No clips available to merge")
            raise ValueError("No clips to merge into final video")
        
        logger.info("Merging all clips into a single video")
        concat_list_path = os.path.join(output_folder, "concat_list.txt")
        with open(concat_list_path, 'w') as f:
            for clip in merged_clips:
                f.write(f"file '{os.path.abspath(clip)}'\n")
        
        cmd_concat = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list_path,
            "-c:v", "libx264", "-c:a", "aac",
            final_output
        ]
        try:
            run_ffmpeg(cmd_concat, "Final video merge failed")
            logger.info(f"Final video saved at {final_output}")
        except Exception as e:
            logger.error(f"Error merging clips: {str(e)}")
        finally:
            safe_remove(concat_list_path)

def main():
    parser = argparse.ArgumentParser(description="Video summarization and localization tool")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument("--output", default="output", help="Output folder")
    parser.add_argument("--lang", default=Config.DEFAULT_LANG, help="Language for text-to-speech (e.g., 'hi', 'en')")
    parser.add_argument("--scenes", type=int, default=Config.DEFAULT_NUM_SCENES, help="Number of scenes to summarize")
    parser.add_argument("--downscale", type=int, default=Config.DEFAULT_DOWNSCALE, help="Downscale factor for processing")
    parser.add_argument("--tts-speed", type=float, default=Config.DEFAULT_TTS_SPEED, help="Speech speed (0.5 to 2.0)")
    args = parser.parse_args()

    try:
        logger.info(f"Processing video: {args.video}")
        processor = ImportantVideo(args.video, lang=args.lang, num_scenes=args.scenes, tts_speed=args.tts_speed)
        processor.downscale(args.downscale)
        processor.detect_scenes()
        processor.top_scenes()
        transcripts = processor.convert_clips_to_text(args.output)
        audio_paths = processor.text_to_speech(transcripts, args.output)
        merged_clips = processor.merge_audio_with_clips(audio_paths, args.output)
        processor.merge_all_clips(merged_clips, args.output)
        logger.info("Video processing completed successfully")
    except Exception as e:
        logger.exception(f"Error processing video: {str(e)}")

if __name__ == "__main__":
    main()