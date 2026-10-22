import { User, Role } from "../../DB/Models/user.model.js";
import { Video } from "../../DB/Models/video.model.js";
import { Quiz } from "../../DB/Models/quiz.model.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getMe = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select("-password");
    if (!admin) return res.status(404).json({ message: "الأدمن غير موجود" });
    res.status(200).json({ admin });
  } catch (error) {
    res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: [Role.ADMIN, Role.SUPERADMIN] }
    }).select("-password").sort({ createdAt: -1 });
    res.status(200).json({ admins });
  } catch (error) {
    res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
  }
};

export const activateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await User.findOne({ _id: adminId, role: Role.ADMIN });
    if (!admin) return res.status(404).json({ message: "الأدمن غير موجود" });

    admin.isActivated = !admin.isActivated;
    await admin.save();

    res.status(200).json({
      message: admin.isActivated ? "تم تفعيل الأدمن ✅" : "تم إلغاء تفعيل الأدمن",
      admin: { ...admin.toObject(), password: undefined }
    });
  } catch (error) {
    res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
  }
};

export const addAdmin = async (req, res) => {
    try {
        const { userName, email, password, phoneNumber } = req.body;
        
        const lowerEmail = email.toLowerCase();
        const userExist = await User.findOne({ email: lowerEmail });
        if (userExist) return res.status(409).json({ message: "هذا البريد الإلكتروني مسجل بالفعل كأدمن" });

        const salt = parseInt(process.env.SALT_ROUNDS) || 10;
        const hashedPassword = bcrypt.hashSync(password, salt);

        const admin = await User.create({
            userName,
            email: lowerEmail,
            password: hashedPassword,
            phoneNumber,
            role: Role.ADMIN, 
            isActivated: true 
        });

        res.status(201).json({ message: "تم إضافة الأدمن بنجاح 💜", admin: { id: admin._id, name: admin.userName } });
    } catch (error) {
        res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
    }
};

export const deleteAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;
        const admin = await User.findByIdAndDelete(adminId);
        
        if (!admin) return res.status(404).json({ message: "الأدمن غير موجود" });
        res.status(200).json({ message: "تم حذف الأدمن بنجاح 🗑️" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
    }
};

// ================= VIDEO MANAGEMENT =================

export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "لم يتم اختيار ملف" });
    }

    const { title, description, category, mode, stage } = req.body;

    if (!title || !category || !stage) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        message: "title, category و stage مطلوبة",
      });
    }

    const filePath = `uploads/videos/${req.file.filename}`;
    const fileName = req.file.filename;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype;

    const video = await Video.create({
      title: title.trim(),
      description: description?.trim() || "",
      category,
      mode: mode || "all",
      stage: Number(stage),
      filePath,
      fileName,
      fileSize,
      fileType,
      uploadedAt: new Date(),
      url: "",
    });

    console.log("✅ Video created:", video._id);

    return res.status(201).json({
      message: "تم رفع الفيديو بنجاح 🎥",
      video: {
        ...video.toObject(),
        fileUrl: `http://localhost:5000/${filePath}`
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("❌ Upload error:", error.message);
    return res.status(400).json({
      message: "فشل رفع الفيديو",
      error: error.message,
    });
  }
};

export const createVideo = async (req, res) => {
  try {
    const video = await Video.create(req.body);
    return res.status(201).json({ 
      message: "Video created successfully 🎥", 
      video: {
        ...video.toObject(),
        fileUrl: video.filePath ? `http://localhost:5000/${video.filePath}` : null
      }
    });
  } catch (error) {
    return res.status(400).json({ message: "Failed to create video", error: error.message });
  }
};

export const getAllVideos = async (req, res) => {
  try {
    const { category, mode, stage } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (mode) filter.mode = mode;
    if (stage) filter.stage = Number(stage);

    const videos = await Video.find(filter).sort({ stage: 1, createdAt: -1 });
    
    const videosWithUrl = videos.map(v => ({
      ...v.toObject(),
      fileUrl: v.filePath ? `http://localhost:5000/${v.filePath}` : null
    }));

    return res.status(200).json({
      message: "تم جلب الفيديوهات بنجاح",
      count: videos.length,
      videos: videosWithUrl,
    });
  } catch (error) {
    return res.status(500).json({
      message: "فشل جلب الفيديوهات",
      error: error.message,
    });
  }
};

export const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "الفيديو غير موجود" });
    
    const videoObj = video.toObject();
    videoObj.fileUrl = video.filePath ? `http://localhost:5000/${video.filePath}` : null;

    return res.status(200).json({
      message: "تم جلب الفيديو بنجاح",
      video: videoObj,
    });
  } catch (error) {
    return res.status(400).json({
      message: "فشل جلب الفيديو",
      error: error.message,
    });
  }
};

export const updateVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "الفيديو غير موجود" });

    if (req.file) {
      if (video.filePath) {
        const oldFilePath = path.join(process.cwd(), video.filePath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log("🗑️ Old file deleted:", oldFilePath);
        }
      }

      video.filePath = `uploads/videos/${req.file.filename}`;
      video.fileName = req.file.filename;
      video.fileSize = req.file.size;
      video.fileType = req.file.mimetype;
      video.uploadedAt = new Date();
    }

    if (req.body.title) video.title = req.body.title.trim();
    if (req.body.description !== undefined) video.description = req.body.description.trim();
    if (req.body.category) video.category = req.body.category;
    if (req.body.mode) video.mode = req.body.mode;
    if (req.body.stage) video.stage = Number(req.body.stage);
    if (req.body.url) video.url = req.body.url.trim();

    await video.save();

    const videoObj = video.toObject();
    videoObj.fileUrl = video.filePath ? `http://localhost:5000/${video.filePath}` : null;

    return res.status(200).json({
      message: "تم تحديث الفيديو بنجاح",
      video: videoObj,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("❌ Update error:", error.message);
    return res.status(400).json({
      message: "فشل تحديث الفيديو",
      error: error.message,
    });
  }
};

export const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    if (!video) return res.status(404).json({ message: "الفيديو غير موجود" });

    if (video.filePath) {
      const filePath = path.join(process.cwd(), video.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🗑️ File deleted:", filePath);
      }
    }

    return res.status(200).json({ message: "تم حذف الفيديو بنجاح" });
  } catch (error) {
    console.error("❌ Delete error:", error.message);
    return res.status(400).json({
      message: "فشل حذف الفيديو",
      error: error.message,
    });
  }
};

export const deleteVideoFile = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "الفيديو غير موجود" });

    if (video.filePath) {
      const filePath = path.join(process.cwd(), video.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🗑️ File deleted:", filePath);
      }

      video.filePath = null;
      video.fileName = "";
      video.fileSize = 0;
      video.uploadedAt = null;
      await video.save();

      return res.status(200).json({
        message: "تم حذف الملف بنجاح",
        video,
      });
    }

    return res.status(400).json({ message: "لا يوجد ملف مرفوع" });
  } catch (error) {
    console.error("❌ Delete file error:", error.message);
    return res.status(400).json({
      message: "فشل حذف الملف",
      error: error.message,
    });
  }
};

// ================= QUIZ MANAGEMENT =================

export const addQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.create(req.body);
    return res.status(201).json({ message: "تم إنشاء الاختبار بنجاح 📝", quiz });
  } catch (error) {
    return res.status(400).json({ message: "فشل إنشاء الاختبار", error: error.message });
  }
};

export const getAllQuizzes = async (req, res) => {
  try {
    const { category, mode, stage, type } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (mode) filter.mode = mode;
    if (stage) filter.stage = Number(stage);
    if (type) filter.type = type;

    const quizzes = await Quiz.find(filter).sort({ stage: 1, createdAt: -1 });
    return res.status(200).json({
      message: "تم جلب الاختبارات بنجاح",
      count: quizzes.length,
      quizzes,
    });
  } catch (error) {
    return res.status(500).json({
      message: "فشل جلب الاختبارات",
      error: error.message,
    });
  }
};

export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "الاختبار غير موجود" });
    return res.status(200).json({ message: "تم جلب الاختبار بنجاح", quiz });
  } catch (error) {
    return res.status(400).json({ message: "فشل جلب الاختبار", error: error.message });
  }
};

export const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!quiz) return res.status(404).json({ message: "الاختبار غير موجود" });
    return res.status(200).json({ message: "تم تحديث الاختبار بنجاح", quiz });
  } catch (error) {
    return res.status(400).json({ message: "فشل تحديث الاختبار", error: error.message });
  }
};

export const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) return res.status(404).json({ message: "الاختبار غير موجود" });
    return res.status(200).json({ message: "تم حذف الاختبار بنجاح" });
  } catch (error) {
    return res.status(400).json({ message: "فشل حذف الاختبار", error: error.message });
  }
};