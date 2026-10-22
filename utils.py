import os
import gc
import cv2
import json
import whisper
import torch
import numpy as np
from PIL import Image
from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

# ─── تحميل الموديلات على كارت الشاشة (GPU) ───────────────────────
print("Loading Whisper model (GPU)...")
whisper_model = whisper.load_model("base", device="cuda")

print("Loading Qwen2.5-VL model (GPU)...")
model_name = "Qwen/Qwen2.5-VL-3B-Instruct"
processor  = AutoProcessor.from_pretrained(model_name)
qwen_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    model_name,
    torch_dtype=torch.float16, # float16 سريعة جداً وممتازة لكروت الشاشة
    device_map="auto"          # النقل التلقائي لكارت الشاشة
)
print("All models loaded successfully on GPU.")


# ─── Step 1: Frame Extraction ────────────────────────────────────────────────
def extract_frames(video_path: str, output_folder: str, fps_target: int = 2) -> int:
    os.makedirs(output_folder, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0: video_fps = 30 
    frame_interval = max(1, int(video_fps / fps_target))
    count, saved = 0, 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if count % frame_interval == 0:
            cv2.imwrite(os.path.join(output_folder, f"frame_{saved:04d}.jpg"), frame)
            saved += 1
        count += 1
    cap.release()
    return saved


# ─── Step 2: Preprocessing ──────────────────────────────────────────────────
def remove_black_bars(img):
    if img is None: return None
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        coords = cv2.findNonZero(gray)
        if coords is None: return img
        x, y, w, h = cv2.boundingRect(coords)
        return img[y:y + h, x:x + w]
    except Exception:
        return img

def resize_frame(img, size: int = 448):
    h, w = img.shape[:2]
    if h > w:
        new_h, new_w = size, int(w * (size / h))
    else:
        new_w, new_h = size, int(h * (size / w))
    new_w = max(28, (new_w // 28) * 28)
    new_h = max(28, (new_h // 28) * 28)
    return cv2.resize(img, (new_w, new_h))

def preprocess_frames(input_folder: str, output_folder: str) -> None:
    os.makedirs(output_folder, exist_ok=True)
    for file in sorted(os.listdir(input_folder)):
        path = os.path.join(input_folder, file)
        img = cv2.imread(path)
        if img is None: continue
        img = remove_black_bars(img)
        if img is None or img.size == 0: continue
        img = resize_frame(img, size=448)
        cv2.imwrite(os.path.join(output_folder, file), img)

def limit_frames(folder: str, max_frames: int = 256) -> None:
    frame_files = sorted(os.listdir(folder))
    if len(frame_files) <= max_frames: return
    for f in frame_files[max_frames:]:
        os.remove(os.path.join(folder, f))


# ─── Step 3: Audio ──────────────────────────────────────────────────────────
def extract_audio(video_path: str, output_audio: str) -> str:
    os.system(f'ffmpeg -i "{video_path}" -q:a 0 -map a "{output_audio}" -y')
    return output_audio

def transcribe_audio(audio_path: str) -> tuple[str, list]:
    if not os.path.exists(audio_path):
        return "No audio found.", []
    result = whisper_model.transcribe(audio_path, word_timestamps=True) 
    return result["text"], result.get("segments", [])


# ─── Step 4: Subtitle Overlay ────────────────────────────────────────────────
def overlay_subtitles(frames_folder: str, output_folder: str, segments: list, fps: int = 2) -> None:
    os.makedirs(output_folder, exist_ok=True)
    frame_files = sorted(os.listdir(frames_folder))
    for i, file in enumerate(frame_files):
        img = cv2.imread(os.path.join(frames_folder, file))
        if img is None: continue
        time_sec = (i + 0.5) / fps
        text = ""
        for seg in segments:
            if seg["start"] <= time_sec <= seg["end"]:
                text = seg["text"].strip()
                break
        if text:
            cv2.putText(img, text, (10, img.shape[0] - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.imwrite(os.path.join(output_folder, file), img)


# ─── Step 5: Qwen Inference ─────────────────────────────────────────────────
def describe_video_frames(frames_dir: str, transcript: str) -> dict:
    all_files = sorted(os.listdir(frames_dir))
    if not all_files: return {}

    num_frames = min(16, len(all_files))
    if num_frames > 1:
        indices = [int(i * (len(all_files) - 1) / (num_frames - 1)) for i in range(num_frames)]
    else:
        indices = [0]
    selected_files = [all_files[i] for i in indices]

    frames = []
    for f in selected_files:
        img = Image.open(os.path.join(frames_dir, f)).convert("RGB")
        img = img.resize((224, 224))
        frames.append(img)

    autism_prompt = f"""
You are a child behavior analyst assistant.
Analyze the child's behavior carefully across all the provided video frames.

The audio transcript from the video is:
\"\"\"{transcript}\"\"\"

Based on BOTH the visual frames AND the transcript above,
identify behaviors related to Autism Spectrum Disorder (ASD).

Return ONLY valid JSON with NO extra text before or after it.
Use exactly this format:

{{
  "eye_contact": "describe whether the child maintains, avoids, or has inconsistent eye contact",
  "social_interaction": "describe how the child interacts or fails to interact with others",
  "response_to_name_or_speech": "does the child respond when called or spoken to?",
  "repetitive_behaviors": "list any repetitive movements, actions, or routines observed",
  "facial_expressions": "describe the range and appropriateness of facial expressions",
  "body_language_and_gestures": "describe posture, pointing, waving, or other gestures",
  "play_behavior": "describe how the child plays — functional, imaginative, or repetitive",
  "language_and_communication": "describe verbal/non-verbal communication observed or mentioned in transcript",
  "sensory_reactions": "any unusual reactions to sounds, textures, lights, or environment",
  "overall_autism_indicators": "summarize which behaviors may align with ASD symptoms"
}}
"""

    messages = [{"role": "user", "content": []}]
    for img in frames:
        messages[0]["content"].append({"type": "image", "image": img})
    messages[0]["content"].append({"type": "text", "text": autism_prompt})

    text_input = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )

    try:
        # البيانات رايحة للـ CUDA (كارت الشاشة)
        inputs = processor(
            text=[text_input],
            images=frames,
            return_tensors="pt"
        ).to("cuda")

        with torch.no_grad():
            output_ids = qwen_model.generate(**inputs, max_new_tokens=512)
            
    except (torch.cuda.OutOfMemoryError, RuntimeError):
        gc.collect()
        torch.cuda.empty_cache()
        inputs = processor(text=[text_input], images=frames, return_tensors="pt").to("cuda")
        with torch.no_grad():
            output_ids = qwen_model.generate(**inputs, max_new_tokens=512)

    generated_ids_trimmed = [
        out_ids[len(in_ids):]
        for in_ids, out_ids in zip(inputs["input_ids"], output_ids)
    ]
    output_text = processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True)[0]

    try:
        clean = output_text.strip().replace("```json", "").replace("```", "").strip()
        behavior_json = json.loads(clean)
    except json.JSONDecodeError:
        behavior_json = {"raw_output": output_text}

    return behavior_json


# ─── Step 6: DSM-5 Rule-Based Evaluation ────────────────────────────────────
def score_field(value: str) -> str:
    v = value.lower().strip()
    NEGATIVE = ["no", "none", "not observed", "not present", "absent",
                "does not", "didn't", "didn't", "never", "0", "flat",
                "solitary", "incomplete", "fragmented", "limited",
                "poor", "minimal", "avoids", "ignores", "sitting still"]
    POSITIVE = ["yes", "present", "observed", "normal", "good",
                "appropriate", "interactive", "responsive", "maintains"]
    if any(n in v for n in NEGATIVE): return "negative"
    if any(p in v for p in POSITIVE): return "positive"
    return "partial"


def evaluate_criteria(bj: dict) -> dict:
    ec  = score_field(bj.get("eye_contact", ""))
    si  = score_field(bj.get("social_interaction", ""))
    rns = score_field(bj.get("response_to_name_or_speech", ""))
    fe  = score_field(bj.get("facial_expressions", ""))
    blg = score_field(bj.get("body_language_and_gestures", ""))
    pb  = score_field(bj.get("play_behavior", ""))
    rb  = score_field(bj.get("repetitive_behaviors", ""))
    sr  = score_field(bj.get("sensory_reactions", ""))

    def decide(scores, threshold=1):
        neg = scores.count("negative")
        pos = scores.count("positive")
        if neg >= threshold and pos == 0: return "Met"
        if neg >= 1 or scores.count("partial") >= 1: return "Partially Met"
        return "Not Observed"

    return {
        "A1_social_emotional_reciprocity": decide([ec, si, rns], threshold=2),
        "A2_nonverbal_communication":      decide([ec, fe, blg], threshold=2),
        "A3_relationships":                decide([si, pb],      threshold=1),
        "B1_stereotyped_repetitive_motor": decide([rb],          threshold=1),
        "B2_insistence_on_sameness":       decide([pb, rns],     threshold=2),
        "B3_restricted_interests":         "Partially Met" if pb == "negative" else "Not Observed",
        "B4_sensory_reactivity":           decide([sr],          threshold=1),
    }


def extract_matched_symptoms(bj: dict, criteria: dict) -> list:
    field_map = {
        "eye_contact":                "Lack of eye contact",
        "social_interaction":         "Impaired social interaction",
        "response_to_name_or_speech": "Does not respond to name/speech",
        "facial_expressions":         "Flat or limited facial expressions",
        "body_language_and_gestures": "Limited gestures/body language",
        "play_behavior":              "Solitary or repetitive play",
        "language_and_communication": "Impaired language/communication",
        "repetitive_behaviors":       "Stereotyped/repetitive behaviors",
        "sensory_reactions":          "Unusual sensory reactions",
    }
    return [label for field, label in field_map.items() if score_field(bj.get(field, "")) == "negative"]


def calculate_severity(criteria: dict) -> tuple:
    met         = sum(1 for v in criteria.values() if v == "Met")
    partial     = sum(1 for v in criteria.values() if v == "Partially Met")
    total_score = met + (partial * 0.5)
    if total_score >= 5: return "Severe",       "High",   met + partial
    elif total_score >= 3: return "Moderate",     "High",   met + partial
    elif total_score >= 1: return "Mild",         "Medium", met + partial
    else: return "Inconclusive", "Low",    0


def build_screening_result(behavior_json: dict) -> dict:
    criteria         = evaluate_criteria(behavior_json)
    matched_symptoms = extract_matched_symptoms(behavior_json, criteria)
    severity, confidence, met_count = calculate_severity(criteria)
    overall_text = behavior_json.get("overall_autism_indicators", "")

    return {
        "criteria_match":          criteria,
        "matched_symptoms":        matched_symptoms,
        "unmatched_or_unclear":    [k for k, v in criteria.items() if v == "Not Observed"],
        "dsm5_criteria_met_count": met_count,
        "overall_assessment":      overall_text or "See criteria above.",
        "severity":                severity,
        "confidence":              confidence,
        "recommendation": (
            "Consult a licensed clinical professional for formal evaluation. "
            "Consider referral for ADOS-2 or ADI-R assessment."
            if met_count > 0 else
            "No clear ASD indicators found in this video. "
            "Monitor development and consult a pediatrician."
        ),
        "disclaimer": "This is NOT a medical diagnosis. For informational purposes only.",
    }