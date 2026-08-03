import json
import copy
import hashlib
import os
import sys
import time
import re
from pathlib import Path

import requests


SENTENCE_PUNCTUATION = set("，。！？；：、,.!?;:")
CJK_PATTERN = re.compile(r"[\u3400-\u9fff]")
LEXICAL_ENGLISH_PATTERN = re.compile(r"[A-Za-z0-9]")
TECHNICAL_NAME_CHARACTER_PATTERN = re.compile(r"[A-Za-z0-9]")
CHECKPOINT_SCHEMA_VERSION = "1.0"


class TranslationValidationError(RuntimeError):
    pass


class TranslationProviderError(RuntimeError):
    def __init__(self, message, *, validation_failure=False):
        super().__init__(message)
        self.validation_failure = validation_failure


def strip_display_punctuation(text):
    characters = list(text)
    kept = []
    for index, character in enumerate(characters):
        if character not in SENTENCE_PUNCTUATION:
            kept.append(character)
            continue
        previous = characters[index - 1] if index > 0 else ""
        following = characters[index + 1] if index + 1 < len(characters) else ""
        if character == "." and (
            TECHNICAL_NAME_CHARACTER_PATTERN.fullmatch(previous)
            and TECHNICAL_NAME_CHARACTER_PATTERN.fullmatch(following)
        ):
            kept.append(character)
        elif character in ",:" and previous.isdigit() and following.isdigit():
            kept.append(character)
    return "".join(kept).strip()

def parse_translation_array(content, expected_length):
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    translated = json.loads(content)
    if not isinstance(translated, list) or len(translated) != expected_length:
        raise TranslationValidationError("Translation provider returned an array with the wrong length")
    if not all(isinstance(item, str) and item.strip() for item in translated):
        raise TranslationValidationError("Translation provider returned an empty or non-string item")
    return translated


def validate_english_translations(items):
    mixed = [index for index, item in enumerate(items) if CJK_PATTERN.search(item)]
    if mixed:
        positions = ", ".join(str(index) for index in mixed[:5])
        raise TranslationValidationError(f"Translation provider left Chinese characters in English items: {positions}")
    empty_meaning = [index for index, item in enumerate(items) if not LEXICAL_ENGLISH_PATTERN.search(item)]
    if empty_meaning:
        positions = ", ".join(str(index) for index in empty_meaning[:5])
        raise TranslationValidationError(f"Translation provider returned English without lexical content: {positions}")
    return items


def glossary_instruction(terminology_profile):
    if not terminology_profile:
        return ""
    pairs = [f'{item["canonicalZh"]} = {item["canonicalEn"]}' for item in terminology_profile.get("entries", [])]
    return " Use these canonical bilingual names exactly: " + "; ".join(pairs)


def canonicalize_translation(text, terminology_profile):
    if not terminology_profile:
        return text
    result = text
    for entry in terminology_profile.get("entries", []):
        candidates = [entry["canonicalZh"], entry["canonicalEn"], *entry.get("sourceVariants", [])]
        for candidate in sorted(set(candidates), key=len, reverse=True):
            if candidate:
                result = result.replace(candidate, entry["canonicalEn"])
    return result


def translate_with_mimo(items, translation_config, terminology_profile=None, requester=requests.post):
    api_key_env = translation_config.get("apiKeyEnv", "MIMO_API_KEY")
    api_key = os.environ.get(api_key_env)
    if not api_key:
        raise RuntimeError(f"Missing {api_key_env}; load it from your shell environment")
    endpoint = translation_config.get("baseUrl", "https://token-plan-cn.xiaomimimo.com/v1").rstrip("/")
    payload = {
        "model": translation_config.get("model", "mimo-v2.5"),
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Translate Chinese talking-head subtitles into concise, faithful English. "
                    "Do not summarize, omit, add, or merge content. Preserve technical terms. "
                    "Translate every array item independently: do not move words into an adjacent item, "
                    "and every non-empty source item must produce English words rather than punctuation alone. "
                    "Return only a JSON array of translated strings in the same order and length."
                    + glossary_instruction(terminology_profile)
                ),
            },
            {"role": "user", "content": json.dumps(items, ensure_ascii=False)},
        ],
    }
    attempts = translation_config.get("maxRetries", 2) + 1
    timeout = float(translation_config.get("timeoutSeconds", 90))
    last_error = None
    for attempt in range(attempts):
        try:
            result = requester(
                f"{endpoint}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=timeout,
            )
            result.raise_for_status()
            response = result.json()
            return validate_english_translations(
                parse_translation_array(response["choices"][0]["message"]["content"], len(items))
            )
        except (requests.RequestException, KeyError, ValueError, RuntimeError) as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(min(2 ** attempt, 4))
    detail = str(last_error).strip() or type(last_error).__name__
    if isinstance(last_error, requests.RequestException) and last_error.response is not None:
        detail = (last_error.response.text or detail).strip()
    detail = re.sub(r"Bearer\s+\S+", "Bearer [redacted]", detail, flags=re.IGNORECASE)[:800]
    raise TranslationProviderError(
        f"MiMo translation failed after {attempts} attempts: {detail}",
        validation_failure=isinstance(last_error, TranslationValidationError),
    )


def translate_offline(items, translation_config, terminology_profile=None):
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    model_id = translation_config.get("offlineFallbackModel", "Helsinki-NLP/opus-mt-zh-en")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
    inputs = tokenizer(items, return_tensors="pt", padding=True, truncation=True, max_length=128)
    outputs = model.generate(**inputs, max_new_tokens=96, num_beams=4)
    return validate_english_translations(
        parse_translation_array(json.dumps(tokenizer.batch_decode(outputs, skip_special_tokens=True)), len(items))
    )


def checkpoint_signature(texts, provider, translation_config, terminology_profile):
    safe_config = {key: value for key, value in translation_config.items() if key != "apiKey"}
    payload = {
        "schemaVersion": CHECKPOINT_SCHEMA_VERSION,
        "texts": texts,
        "provider": provider,
        "translationConfig": safe_config,
        "terminologyProfile": terminology_profile,
    }
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf8")).hexdigest()


def read_checkpoint(path, signature, item_count):
    try:
        value = json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {"schemaVersion": CHECKPOINT_SCHEMA_VERSION, "signature": signature, "items": {}}
    if (
        value.get("schemaVersion") != CHECKPOINT_SCHEMA_VERSION
        or value.get("signature") != signature
        or value.get("itemCount") != item_count
        or not isinstance(value.get("items"), dict)
    ):
        return {"schemaVersion": CHECKPOINT_SCHEMA_VERSION, "signature": signature, "items": {}}
    return value


def write_checkpoint(path, checkpoint, item_count):
    path.parent.mkdir(parents=True, exist_ok=True)
    value = {**checkpoint, "itemCount": item_count, "updatedAt": time.time()}
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def translate_range(
    texts,
    start,
    end,
    provider,
    translation_config,
    terminology_profile,
    checkpoint,
    checkpoint_path,
):
    key = f"{start}:{end}"
    cached = checkpoint["items"].get(key)
    if isinstance(cached, list) and len(cached) == end - start:
        try:
            validate_english_translations(cached)
            print(f"reused translated items {start + 1}-{end}/{len(texts)} via {provider}")
            return cached
        except TranslationValidationError:
            del checkpoint["items"][key]
    midpoint = start + max(1, (end - start) // 2)
    if end - start > 1 and (
        f"{start}:{midpoint}" in checkpoint["items"] or f"{midpoint}:{end}" in checkpoint["items"]
    ):
        return [
            *translate_range(
                texts, start, midpoint, provider, translation_config, terminology_profile, checkpoint, checkpoint_path
            ),
            *translate_range(
                texts, midpoint, end, provider, translation_config, terminology_profile, checkpoint, checkpoint_path
            ),
        ]
    batch = texts[start:end]
    try:
        if provider == "mimo":
            translated = translate_with_mimo(batch, translation_config, terminology_profile)
        elif provider == "offline":
            translated = translate_offline(batch, translation_config, terminology_profile)
        else:
            raise RuntimeError(f"Unsupported translation provider: {provider}")
    except (TranslationProviderError, TranslationValidationError) as error:
        validation_failure = isinstance(error, TranslationValidationError) or error.validation_failure
        if not validation_failure or end - start <= 1:
            raise RuntimeError(f"Translation batch {start + 1}-{end} failed: {error}") from error
        print(
            f"translation validation failed for items {start + 1}-{end}; "
            f"retrying as {start + 1}-{midpoint} and {midpoint + 1}-{end}: {error}",
            file=sys.stderr,
        )
        return [
            *translate_range(
                texts, start, midpoint, provider, translation_config, terminology_profile, checkpoint, checkpoint_path
            ),
            *translate_range(
                texts, midpoint, end, provider, translation_config, terminology_profile, checkpoint, checkpoint_path
            ),
        ]
    checkpoint["items"][key] = translated
    write_checkpoint(checkpoint_path, checkpoint, len(texts))
    print(f"translated items {start + 1}-{end}/{len(texts)} via {provider}")
    return translated


def main(config_path):
    config = json.loads(Path(config_path).read_text())
    source_path = Path(
        config.get("semanticCaptionSourceFile", Path(config["editDir"]) / "captions-semantic.source.json")
    )
    semantic_output_path = Path(
        config.get("semanticCaptionsFile", Path(config["editDir"]) / "captions-semantic.json")
    )
    output_path = Path(config.get("captionsFile", Path(config["editDir"]) / "captions-verbatim.json"))
    captions = json.loads(source_path.read_text())
    texts = [cue["zh"] for cue in captions]
    translation_config = config.get("translation", {})
    display_punctuation = config.get("captionDisplayPunctuation", "none")
    terminology_profile = None
    if config.get("terminologyProfileFile"):
        terminology_profile = json.loads(Path(config["terminologyProfileFile"]).read_text())
    provider = translation_config.get("provider", "mimo")
    checkpoint_path = Path(
        config.get("translationCheckpointFile", semantic_output_path.with_name("translation-checkpoint.json"))
    )
    signature = checkpoint_signature(texts, provider, translation_config, terminology_profile)
    checkpoint = read_checkpoint(checkpoint_path, signature, len(texts))
    translations = []
    for start in range(0, len(texts), 16):
        end = min(start + 16, len(texts))
        translations.extend(
            translate_range(
                texts,
                start,
                end,
                provider,
                translation_config,
                terminology_profile,
                checkpoint,
                checkpoint_path,
            )
        )
    for cue, english in zip(captions, translations):
        canonical = canonicalize_translation(english, terminology_profile)
        cue["en"] = canonical
    semantic_output_path.write_text(json.dumps(captions, ensure_ascii=False, indent=2) + "\n")
    display_captions = copy.deepcopy(captions)
    if display_punctuation == "none":
        for cue in display_captions:
            cue["zh"] = strip_display_punctuation(cue["zh"])
            cue["en"] = strip_display_punctuation(cue["en"])
    output_path.write_text(json.dumps(display_captions, ensure_ascii=False, indent=2) + "\n")
    checkpoint_path.unlink(missing_ok=True)
    print(semantic_output_path)
    print(output_path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "config/workflow-test.json")
