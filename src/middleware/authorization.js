import { Role } from "../DB/Models/user.model.js";

export const isAuthorized = (allowedRoles = []) => {
    return (req, res, next) => {
        console.log("🔓 Authorization middleware running...");
        
        // ✅ التحقق من وجود الـ user
        if (!req.user) {
            console.error("❌ No user attached to request");
            return res.status(401).json({ message: "User not authenticated" });
        }

        console.log("👤 User in request:", {
            id: req.user._id,
            role: req.user.role || "child"
        });

        // ✅ إذا كان الـ user عبارة عن Child (بدون role)، اسمح دائماً
        if (!req.user.role) {
            console.log("✅ User is a Child (no role required)");
            return next();
        }

        // ✅ التحقق من الـ role للـ Users (Parents/Admins)
        if (!allowedRoles.includes(req.user.role)) {
            console.error(`❌ User role '${req.user.role}' not authorized`);
            console.error(`    Allowed roles: ${allowedRoles.join(", ")}`);
            return res.status(403).json({ 
                message: "You are not authorized to perform this action",
                userRole: req.user.role,
                allowedRoles: allowedRoles
            });
        }

        console.log(`✅ User authorized with role: ${req.user.role}`);
        next();
    };
};