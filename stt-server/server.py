"""Local STT HTTP server using faster-whisper.

Listens on http://127.0.0.1:8765 and accepts POST /transcribe with JSON body:
    { "audioBase64": "<base64 PCM16>", "sampleRateHz": 16000, "channels": 1 }

Returns:
    { "text": "transcribed text", "confidence": 0.95 }
"""

import base64
import io
import os
import struct
import sys
import tempfile

import numpy as np
from flask import Flask, jsonify, request as flask_request
from faster_whisper import WhisperModel

app = Flask(__name__)

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "auto")

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        print(f"Loading whisper model '{MODEL_SIZE}' on device '{DEVICE}'...",
              file=sys.stderr)
        _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type="int8")
        print("Model loaded.", file=sys.stderr)
    return _model


def pcm16_to_float32(raw: bytes, sample_rate: int) -> np.ndarray:
    """Convert raw PCM16 LE bytes to float32 numpy array normalized to [-1, 1]."""
    count = len(raw) // 2
    samples = struct.unpack(f"<{count}h", raw[:count * 2])
    arr = np.array(samples, dtype=np.float32) / 32768.0
    return arr


def float32_to_wav_tempfile(audio: np.ndarray, sample_rate: int) -> str:
    """Write float32 audio to a temp WAV file and return the path."""
    import wave

    pcm16 = (audio * 32767).astype(np.int16)
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(tmp.name, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())
    return tmp.name


@app.route("/transcribe", methods=["POST"])
def transcribe():
    data = flask_request.get_json(force=True)
    audio_b64 = data.get("audioBase64", "")
    sample_rate = int(data.get("sampleRateHz", 16000))

    if not audio_b64:
        return jsonify({"text": "", "confidence": 0.0}), 200

    raw_pcm = base64.b64decode(audio_b64)
    if len(raw_pcm) < 1600:
        return jsonify({"text": "", "confidence": 0.0}), 200

    audio_f32 = pcm16_to_float32(raw_pcm, sample_rate)

    model = get_model()
    segments, info = model.transcribe(
        audio_f32,
        beam_size=5,
        language="en",
        vad_filter=True
    )

    texts = []
    total_prob = 0.0
    seg_count = 0
    for seg in segments:
        texts.append(seg.text.strip())
        total_prob += seg.avg_log_prob
        seg_count += 1

    full_text = " ".join(texts).strip()
    avg_confidence = (total_prob / seg_count) if seg_count > 0 else 0.0

    return jsonify({"text": full_text, "confidence": round(avg_confidence, 4)}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    get_model()
    app.run(host="127.0.0.1", port=8765, debug=False)
