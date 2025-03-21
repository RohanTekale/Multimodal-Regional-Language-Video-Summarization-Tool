# Placeholder for unit tests (optional implementation)
import unittest
from src.important_video import ImportantVideo

class TestImportantVideo(unittest.TestCase):
    def test_init(self):
        video_path = "input/videoplayback.mp4"
        processor = ImportantVideo(video_path)
        self.assertEqual(processor.video_path, video_path)

if __name__ == "__main__":
    unittest.main()