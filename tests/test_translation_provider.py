import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "translate_captions.py"
SPEC = importlib.util.spec_from_file_location("translate_captions", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TranslationProviderTest(unittest.TestCase):
    def test_parses_fenced_json_without_changing_order(self):
        self.assertEqual(MODULE.parse_translation_array('```json\n["one", "two"]\n```', 2), ["one", "two"])

    def test_rejects_wrong_result_length(self):
        with self.assertRaisesRegex(RuntimeError, "wrong length"):
            MODULE.parse_translation_array('["one"]', 2)

    def test_rejects_code_mixed_english(self):
        with self.assertRaisesRegex(RuntimeError, "left Chinese characters"):
            MODULE.validate_english_translations(["The model能力 improved"])

    def test_rejects_punctuation_only_english(self):
        with self.assertRaisesRegex(RuntimeError, "without lexical content"):
            MODULE.validate_english_translations(["."])

    def test_canonicalizes_translation_from_shared_profile(self):
        profile = {"entries": [{
            "canonicalZh": "流动相", "canonicalEn": "mobile phase", "sourceVariants": ["mobile formula"]
        }]}
        self.assertEqual(MODULE.canonicalize_translation("Replace the mobile formula", profile), "Replace the mobile phase")
        self.assertIn("流动相 = mobile phase", MODULE.glossary_instruction(profile))

    def test_removes_sentence_punctuation_but_preserves_numeric_punctuation(self):
        self.assertEqual(
            MODULE.strip_display_punctuation("Accuracy 91.5%, latency 8:30; cost 1,200."),
            "Accuracy 91.5% latency 8:30 cost 1,200",
        )

    def test_preserves_dots_inside_technical_names(self):
        self.assertEqual(
            MODULE.strip_display_punctuation("创建 THREE.Group，并展示 Three.js。"),
            "创建 THREE.Group并展示 Three.js",
        )

    @patch.dict(os.environ, {"TEST_MIMO_KEY": "secret-value"})
    def test_mimo_uses_configured_model_and_never_returns_secret(self):
        calls = []

        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"choices": [{"message": {"content": json.dumps(["Hello", "World"])}}]}

        def requester(url, **kwargs):
            calls.append((url, kwargs))
            return Response()

        result = MODULE.translate_with_mimo(
            ["你好", "世界"],
            {"apiKeyEnv": "TEST_MIMO_KEY", "model": "mimo-v2.5", "baseUrl": "https://example.test/v1", "maxRetries": 0},
            requester=requester,
        )
        self.assertEqual(result, ["Hello", "World"])
        payload = calls[0][1]["json"]
        self.assertEqual(payload["model"], "mimo-v2.5")
        self.assertNotIn("secret-value", json.dumps(payload))
        self.assertNotIn("secret-value", calls[0][0])

    @patch.dict(os.environ, {"TEST_MIMO_KEY": "secret-value"})
    def test_mimo_reports_the_sanitized_validation_reason(self):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {"choices": [{"message": {"content": json.dumps(["仍然是中文"])}}]}

        def requester(_url, **_kwargs):
            return Response()

        with self.assertRaisesRegex(MODULE.TranslationProviderError, "left Chinese characters"):
            MODULE.translate_with_mimo(
                ["你好"],
                {"apiKeyEnv": "TEST_MIMO_KEY", "maxRetries": 0},
                requester=requester,
            )

    def test_translation_range_splits_validation_failures_and_checkpoints_successes(self):
        calls = []

        def translate(items, *_args, **_kwargs):
            calls.append(items)
            if len(items) > 1:
                raise MODULE.TranslationProviderError("invalid batch", validation_failure=True)
            return [f"English {items[0]}"]

        with tempfile.TemporaryDirectory() as directory:
            checkpoint_path = Path(directory) / "checkpoint.json"
            checkpoint = {"schemaVersion": "1.0", "signature": "test", "items": {}}
            with patch.object(MODULE, "translate_with_mimo", side_effect=translate):
                result = MODULE.translate_range(
                    ["一", "二"], 0, 2, "mimo", {}, None, checkpoint, checkpoint_path
                )
            self.assertEqual(result, ["English 一", "English 二"])
            self.assertEqual(calls, [["一", "二"], ["一"], ["二"]])
            saved = json.loads(checkpoint_path.read_text())
            self.assertEqual(saved["items"]["0:1"], ["English 一"])
            self.assertEqual(saved["items"]["1:2"], ["English 二"])

    def test_translation_range_resumes_from_completed_split_children(self):
        with tempfile.TemporaryDirectory() as directory:
            checkpoint_path = Path(directory) / "checkpoint.json"
            checkpoint = {
                "schemaVersion": "1.0",
                "signature": "test",
                "items": {"0:1": ["One"]},
            }
            with patch.object(MODULE, "translate_with_mimo", return_value=["Two"]) as translate:
                result = MODULE.translate_range(
                    ["一", "二"], 0, 2, "mimo", {}, None, checkpoint, checkpoint_path
                )
            self.assertEqual(result, ["One", "Two"])
            translate.assert_called_once_with(["二"], {}, None)


if __name__ == "__main__":
    unittest.main()
