import jwt from "jsonwebtoken";
import { User } from "../DB/Models/user.model.js";
import { Child } from "../DB/Models/child.model.js";

export const auth = async (req, res, next) => {
    try {
        console.log("🔐 Auth middleware running...");
        console.log("📍 Authorization header:", req.headers.authorization?.substring(0, 50) + "...");

        const { authorization } = req.headers;

        if (!authorization) {
            console.error("❌ No Authorization header provided");
            return res.status(401).json({ message: "No authorization token provided" });
        }

        // ✅ معالجة صيغ مختلفة:
        // 1. "Bearer Sila__eyJ..."
        // 2. "Sila__eyJ..."
        
        let tokenWithPrefix = authorization;

        // ✅ إذا بدأ بـ "Bearer " شيل الـ prefix
        if (authorization.startsWith("Bearer ")) {
            tokenWithPrefix = authorization.substring(7); // شيل "Bearer "
            console.log("✅ Removed 'Bearer ' prefix");
        }

        // ✅ تحقق من وجود "Sila__"
        if (!tokenWithPrefix.startsWith("Sila__")) {
            console.error(`❌ Invalid token format - doesn't start with 'Sila__'`);
            console.error(`    Token starts with: ${tokenWithPrefix.substring(0, 20)}`);
            return res.status(400).json({ message: "Invalid token format" });
        }

        // ✅ استخرج الـ JWT من الـ token (شيل "Sila__")
        const jwtToken = tokenWithPrefix.substring(6); // شيل "Sila__"
        console.log("🔑 JWT Token extracted (first 30 chars):", jwtToken.substring(0, 30) + "...");

        // ✅ تحقق من الـ JWT
        const decoded = jwt.verify(jwtToken, process.env.SECRET_KEY);
        console.log("✅ Token verified successfully");
        console.log("📝 Decoded payload:", {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        });

        if (!decoded?.id) {
            console.error("❌ Decoded token has no ID");
            return res.status(400).json({ message: "Invalid payload" });
        }

        console.log("🔍 Looking for user/child with ID:", decoded.id);

        // ✅ ابحث عن الـ User أولاً
        let user = await User.findById(decoded.id);
        console.log("👤 User found:", user ? "YES ✅" : "NO");
        
        // ✅ إذا لم تجد user، ابحث عن Child
        if (!user) {
            user = await Child.findById(decoded.id);
            console.log("👶 Child found:", user ? "YES ✅" : "NO");
        }

        // ✅ إذا لم تجد أي منهما، ارجع خطأ
        if (!user) {
            console.error("❌ User/Child not found with ID:", decoded.id);
            return res.status(404).json({ message: "User not found" });
        }

        console.log("✅ User/Child authenticated successfully");
        console.log(`   Type: ${user.email ? "User (Parent)" : "Child"}`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Name: ${user.userName || user.name}`);
        
        // ✅ أضف البيانات للـ request
        req.user = user;
        next(); 

    } catch (error) {
        console.error("❌ Auth Error:", error.message);
        
        // ✅ معالجة أنواع مختلفة من الأخطاء
        if (error.name === "JsonWebTokenError") {
            console.error("   Reason: Invalid JWT signature or structure");
            return res.status(401).json({ message: "Invalid token" });
        }
        
        if (error.name === "TokenExpiredError") {
            console.error("   Reason: Token has expired");
            return res.status(401).json({ message: "Token expired" });
        }

        return res.status(500).json({ 
            message: "Authentication error", 
            error: error.message 
        });
    }
};