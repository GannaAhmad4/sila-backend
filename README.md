# 🧠 Autism Screening API — FastAPI

تحليل سلوك الأطفال من الفيديو باستخدام الذكاء الاصطناعي للكشف المبكر عن مؤشرات طيف التوحد.

> ⚠️ **تنبيه مهم:** هذا النظام **ليس أداة تشخيص طبي**. النتائج للاسترشاد فقط ولا تُغني عن تقييم طبيب متخصص.

---

## ✨ ما الذي يفعله هذا المشروع؟

بمجرد رفع فيديو لطفل، يقوم النظام تلقائياً بـ:

```
الفيديو
  │
  ├── 1. استخراج الـ frames (صور من الفيديو كل ثانيتين)
  │
  ├── 2. معالجة الصور (إزالة الأشرطة السوداء + تغيير الحجم)
  │
  ├── 3. استخراج الصوت وتحويله لنص (Whisper AI)
  │
  ├── 4. إضافة النص كـ subtitles على الصور
  │
  ├── 5. تحليل السلوك بصرياً ولغوياً (Qwen2.5-VL)
  │       ← التواصل البصري، التفاعل الاجتماعي،
  │          السلوكيات التكرارية، لغة الجسد...
  │
  └── 6. تقييم وفق معايير DSM-5
          ← severity (Mild / Moderate / Severe)
          ← confidence (Low / Medium / High)
          ← الأعراض المطابقة + التوصية
```

---

## 🖥️ متطلبات التشغيل

### الحد الأدنى (CPU فقط)
| المكوّن | المتطلب |
|--------|---------|
| Python | 3.10 |
| RAM | 16 GB على الأقل |
| مساحة القرص | ~10 GB (للموديلات) |
| FFmpeg | مثبّت ومضاف للـ PATH |

### للتشغيل على GPU ⚡ (أسرع بكثير)
| المكوّن | المتطلب |
|--------|---------|
| كرت الشاشة | NVIDIA (4 GB VRAM على الأقل) |
| CUDA | 12.8+ |
| PyTorch | نسخة مبنية لكرت الشاشة بتاعك |

> 💡 **ملاحظة لأصحاب RTX 5050 / 5060 / 5070 (Blackwell):** كروت الشاشة الجديدة تحتاج PyTorch nightly — اتبعي [خطوات التثبيت للـ GPU](#-تثبيت-pytorch-للـ-gpu) في الأسفل.

---

## 🚀 خطوات التشغيل

### الخطوة 1 — تثبيت FFmpeg

FFmpeg ضروري لاستخراج الصوت من الفيديو.

**Windows:**
1. حمّلي من [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. فكّي الضغط في `C:\ffmpeg`
3. أضيفي `C:\ffmpeg\bin` إلى الـ PATH:
   - ابحثي عن "Environment Variables" في قائمة Start
   - في "System Variables" → "Path" → "Edit" → "New"
   - اكتبي `C:\ffmpeg\bin` ثم OK
4. أعيدي تشغيل الـ Terminal وتأكدي:
   ```bash
   ffmpeg -version
   ```

---

### الخطوة 2 — إنشاء بيئة Python افتراضية

```bash
# في مجلد المشروع
python -m venv .venv

# تفعيل البيئة
# Windows:
.venv\Scripts\activate

# Mac/Linux:
source .venv/bin/activate
```

---

### الخطوة 3 — تثبيت المكتبات

```bash
pip install fastapi uvicorn python-multipart
pip install openai-whisper
pip install transformers accelerate
pip install opencv-python pillow
pip install qwen-vl-utils
```

---

### الخطوة 4 — تثبيت PyTorch

#### أ) تشغيل على CPU فقط (أبطأ):
```bash
pip install torch torchvision torchaudio
```

#### ب) تثبيت PyTorch للـ GPU

**أولاً تأكدي من كرت الشاشة بتاعتك:**
```bash
nvidia-smi
```
شوفي قيمة "CUDA Version" في الركن الأيمن العلوي.

| كرت الشاشة | الأمر الصح |
|------------|-----------|
| RTX 30xx / 40xx | `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126` |
| RTX 5050 / 5060 / 5070 / 5080 / 5090 (Blackwell) | استخدمي الأمر nightly أدناه |

**لكروت Blackwell (sm_120) فقط:**
```bash
pip uninstall torch torchvision torchaudio -y
pip install --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu128
```

**تأكيد نجاح التثبيت:**
```bash
python -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
```
المفروض يطلع:
```
CUDA: True
GPU: NVIDIA GeForce RTX ...
```

---

### الخطوة 5 — تشغيل السيرفر

```bash
python main.py
```

ستظهر هذه الرسائل (الموديلات بتتحمل أول مرة فقط):
```
Loading Whisper model...
Loading Qwen2.5-VL model...
All models loaded.
INFO: Uvicorn running on http://0.0.0.0:8000
```

> ⏳ أول تشغيل بياخد وقت لتحميل الموديلات (~2-5 دقايق حسب سرعة النت والجهاز).
> من المرة التانية بيبدأ أسرع لأن الموديلات بتتحفظ محلياً.

---

## 📡 استخدام الـ API

### الواجهة التفاعلية (Swagger)
بعد التشغيل، افتحي في المتصفح:
```
http://localhost:8000/docs
```

---

### الـ Endpoints

#### `POST /analyze-video`
رفع فيديو والحصول على التحليل الكامل.

**الطلب:**
```bash
curl -X POST "http://localhost:8000/analyze-video" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@video.mp4"
```

**الرد (مثال):**
```json
{
  "status": "success",
  "request_id": "abc-123-xyz",
  "analysis": {
    "frames_processed": 48,
    "transcription": "ماما... ماما...",
    "observed_behaviors": {
      "eye_contact": "The child rarely makes eye contact with the camera or adults",
      "social_interaction": "Limited interaction observed; child plays alone",
      "repetitive_behaviors": "Repetitive hand flapping noted multiple times",
      "facial_expressions": "Flat affect; minimal emotional expression",
      "play_behavior": "Solitary, repetitive play with same object",
      "language_and_communication": "Single words only; no back-and-forth communication",
      "sensory_reactions": "No unusual sensory reactions visible",
      "body_language_and_gestures": "No pointing or waving observed",
      "response_to_name_or_speech": "Does not respond when called by name",
      "overall_autism_indicators": "Several behaviors align with ASD criteria"
    },
    "screening_result": {
      "severity": "Moderate",
      "confidence": "High",
      "dsm5_criteria_met_count": 5,
      "matched_symptoms": [
        "Lack of eye contact",
        "Impaired social interaction",
        "Does not respond to name/speech",
        "Stereotyped/repetitive behaviors",
        "Solitary or repetitive play"
      ],
      "criteria_match": {
        "A1_social_emotional_reciprocity": "Met",
        "A2_nonverbal_communication": "Met",
        "A3_relationships": "Met",
        "B1_stereotyped_repetitive_motor": "Met",
        "B2_insistence_on_sameness": "Partially Met",
        "B3_restricted_interests": "Partially Met",
        "B4_sensory_reactivity": "Not Observed"
      },
      "recommendation": "Consult a licensed clinical professional for formal evaluation. Consider referral for ADOS-2 or ADI-R assessment.",
      "disclaimer": "This is NOT a medical diagnosis. For informational purposes only."
    }
  }
}
```

#### `GET /health`
التأكد إن السيرفر شغال:
```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

---

## 📁 هيكل الملفات

```
FastAPI/
├── main.py          ← السيرفر والـ endpoints
├── utils.py         ← كل منطق الـ AI (Whisper + Qwen + DSM-5)
├── temp_data/       ← ملفات مؤقتة (بتتنشأ تلقائياً أثناء التحليل)
│   └── {request_id}/
│       ├── frames/             ← الصور الخام من الفيديو
│       ├── processed_frames/   ← بعد المعالجة
│       ├── final_frames/       ← بعد إضافة الـ subtitles
│       └── audio.wav           ← الصوت المستخرج
└── README.md
```

---

## ⚙️ مراحل التحليل بالتفصيل

| # | المرحلة | الأداة | الوصف |
|---|---------|--------|-------|
| 1 | استخراج الـ frames | OpenCV | صورة كل 0.5 ثانية (2 fps)، بحد أقصى 256 صورة |
| 2 | معالجة الصور | OpenCV | إزالة الأشرطة السوداء + تغيير الحجم لـ 448px |
| 3 | استخراج الصوت | FFmpeg | تحويل الصوت لـ WAV |
| 4 | تحويل الكلام لنص | Whisper (base) | مع timestamps لكل جملة |
| 5 | إضافة subtitles | OpenCV | كتابة الكلام على الصور في توقيته |
| 6 | تحليل السلوك | Qwen2.5-VL-3B | تحليل 16 صورة موزعة + النص معاً |
| 7 | تقييم DSM-5 | Rule-based | تصنيف تلقائي وفق معايير التوحد |

---

## 🐞 مشاكل شائعة وحلولها

| المشكلة | السبب | الحل |
|---------|-------|------|
| `ffmpeg: command not found` | FFmpeg مش في الـ PATH | راجعي خطوة تثبيت FFmpeg |
| `CUDA error: no kernel image` | نسخة PyTorch مش متوافقة مع كرت الشاشة | استخدمي أمر nightly لـ cu128 |
| `OutOfMemoryError` | الـ VRAM مش كافية | قللي عدد الـ frames في `utils.py` من 16 لـ 8 |
| `Torch not compiled with CUDA` | تثبيت نسخة CPU من PyTorch | أعيدي التثبيت بـ index-url الصح |
| التحليل بياخد وقت طويل | شغالة على CPU | انتقلي للـ GPU أو قللي الـ frames |

---

## 📦 كل المكتبات المستخدمة

```
fastapi
uvicorn
python-multipart
openai-whisper
transformers
accelerate
qwen-vl-utils
opencv-python
pillow
torch
torchvision
```

---

*Made with ❤️ — للتواصل أو الاستفسار ابعتي على GitHub*
