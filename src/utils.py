import subprocess
import os
import logging

logger = logging.getLogger("VideoProcessor")

def run_ffmpeg(cmd: list, error_message: str) -> None:
    """Run an ffmpeg command and handle errors."""
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode != 0:
        logger.error(f"{error_message}: {result.stderr.decode() if result.stderr else 'Unknown error'}")
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)
    logger.debug(f"ffmpeg command succeeded: {' '.join(cmd)}")

def safe_remove(file_path: str) -> None:
    """Safely remove a file if it exists."""
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Failed to remove {file_path}: {str(e)}")