import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "detect-layout.py"
SPEC = importlib.util.spec_from_file_location("detect_layout", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LayoutDetectionTest(unittest.TestCase):
    def test_maps_face_position_to_protected_overlay_layout(self):
        self.assertEqual(
            MODULE.select_layout_template(0.25),
            ("right", 0.92, "speaker-left-overlay-right"),
        )
        self.assertEqual(
            MODULE.select_layout_template(0.50),
            ("left", 0.78, "speaker-center-left"),
        )
        self.assertEqual(
            MODULE.select_layout_template(0.75),
            ("left", 0.92, "speaker-right-overlay-left"),
        )


if __name__ == "__main__":
    unittest.main()
