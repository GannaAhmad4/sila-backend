import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./src/DB/connect.js"; 
import authRouter from "./src/modules/auth/auth.routes.js";
import adminRouter from "./src/modules/admin/admin.routes.js"; 
import lessonsRouter from "./src/modules/lessons/lessons.routes.js";
import activitiesRouter from "./src/modules/activities/activities.routes.js";
import progressRouter from "./src/modules/progress/progress.routes.js";
import { openApiSpec } from "./src/docs/openapi.js";
import userRouter from "./src/modules/user/user.routes.js";
import reportRouter from "./src/modules/report/report.routes.js"; // ✅ أضف هنا
import autismScreeningRouter from "./src/modules/AutismScreening/Autismscreening.routes.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ✅ CORS محدّث للـ port 3000
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ✅ خدمة الملفات المرفوعة (CORS enabled)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ... other imports and setup ...

await connectDB();

// ✅ Auth routes (before everything)
app.use("/auth", authRouter);

// ✅ Admin routes
app.use("/admin", adminRouter); 

// ✅ User routes (BEFORE lessons for priority)
app.use("/user", userRouter);

// ✅ Lessons routes
app.use("/lessons", lessonsRouter);
app.use("/lessons/progress", progressRouter);

// ✅ Activities routes
app.use("/activities", activitiesRouter);

// ✅ Report routes ← أضف هنا
app.use("/report", reportRouter);

// ✅ Autism Screening routes
app.use("/autism-screenings", autismScreeningRouter);

// ✅ Docs
app.get("/docs.json", (req, res) => res.status(200).json(openApiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

// ✅ Home
app.get("/", (req, res) => res.send("Welcome to Sila Platform API 💜"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} ... Ready for Grad 2026!`);
});