from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
import uuid

from utils import (
    extract_frames,
    extract_audio,
    transcribe_audio,
    preprocess_frames,
    limit_frames,
    overlay_subtitles,
    describe_video_frames,
    build_screening_result,
)

app = FastAPI(title="Autism Screening API")

TEMP_BASE = "temp_data"
os.makedirs(TEMP_BASE, exist_ok=True)


@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    request_id  = str(uuid.uuid4())
    request_dir = os.path.join(TEMP_BASE, request_id)

    # مجلدات المراحل (نفس ترتيب النوتبوك)
    frames_dir    = os.path.join(request_dir, "frames")           # raw frames
    proc_dir      = os.path.join(request_dir, "processed_frames") # after preprocess
    final_dir     = os.path.join(request_dir, "final_frames")     # after subtitles
    audio_path    = os.path.join(request_dir, "audio.wav")
    video_path    = os.path.join(request_dir, file.filename)

    os.makedirs(request_dir, exist_ok=True)

    try:
        # 1. حفظ الفيديو
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. استخراج الـ frames الخام
        frames_count = extract_frames(video_path, frames_dir, fps_target=2)

        # 3. Preprocessing (remove black bars + resize)
        preprocess_frames(frames_dir, proc_dir)

        # 4. تحديد max 256 frame
        limit_frames(proc_dir, max_frames=256)

        # 5. استخراج الصوت
        extract_audio(video_path, audio_path)

        # 6. Transcription بـ Whisper
        transcript, segments = transcribe_audio(audio_path)

        # 7. Overlay subtitles
        overlay_subtitles(proc_dir, final_dir, segments, fps=2)

        # 8. Qwen inference (بالـ transcript + final frames)
        behavior_json = describe_video_frames(final_dir, transcript)

        # 9. DSM-5 rule-based screening
        screening_result = build_screening_result(behavior_json)

        return {
            "status":     "success",
            "request_id": request_id,
            "analysis": {
                "frames_processed": frames_count,
                "transcription":    transcript,
                "observed_behaviors": behavior_json,
                "screening_result":   screening_result,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # يمكنك إزالة علامة # من السطر القادم إذا أردتِ مسح الفيديوهات تلقائياً بعد التحليل لتوفير المساحة
        # shutil.rmtree(request_dir, ignore_errors=True)
        pass


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)