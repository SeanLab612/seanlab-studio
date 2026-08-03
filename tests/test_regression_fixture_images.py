import importlib.util
import unittest
from pathlib import Path

import numpy as np

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "regression_fixture_images.py"
SPEC = importlib.util.spec_from_file_location("regression_fixture_images", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RegressionFixtureImageTest(unittest.TestCase):
    def test_dhash_is_deterministic_and_hamming_detects_change(self):
        image = np.zeros((108, 192, 3), dtype=np.uint8)
        image[:, 96:] = 255
        first = MODULE.dhash(image)
        self.assertEqual(first, MODULE.dhash(image.copy()))
        self.assertEqual(MODULE.hamming(first, first), 0)
        inverse = 0xFFFFFFFFFFFFFFFF ^ int(first, 16)
        self.assertEqual(MODULE.hamming(first, f"{inverse:016x}"), 64)


if __name__ == "__main__":
    unittest.main()
