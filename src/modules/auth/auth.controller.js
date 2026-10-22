import { User, Role } from "../../DB/Models/user.model.js"; 
import { Child } from "../../DB/Models/child.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sendEmail from "../../utils/sendEmail.js";
import { activationTemplate } from "../../utils/templateHtml.js";

export const register = async (req, res) => {
    try {
        const { userName, email, password, phoneNumber, 
                childName, childPassword, childAge, childGender, status } = req.body;

        const userExist = await User.findOne({ email: email.toLowerCase() });
        if (userExist) return res.status(409).json({ message: "هذا البريد مسجل بالفعل" });

        const salt = parseInt(process.env.SALT_ROUNDS) || 10;
        
        const parent = await User.create({
            userName, 
            email: email.toLowerCase(), 
            phoneNumber,
            password: bcrypt.hashSync(password, salt),
            role: Role.PARENT
        });

        try {
            await Child.create({
                name: childName, 
                age: childAge, 
                gender: childGender, 
                status: status || "normal",
                password: bcrypt.hashSync(childPassword, salt),
                parentId: parent._id
            });
        } catch (childError) {
            await User.findByIdAndDelete(parent._id);
            return res.status(400).json({ message: "خطأ في بيانات الطفل، لم يتم إنشاء الحساب", error: childError.message });
        }

        const token = jwt.sign({ email: email.toLowerCase() }, process.env.SECRET_KEY, { expiresIn: '1h' }); 
        const link = `${req.protocol}://${req.headers.host}/auth/activate/${token}`;

        await sendEmail({
            to: email,
            subject: "تفعيل حساب منصة صلة 💜",
            html: activationTemplate(link, userName)
        });

        res.status(201).json({ message: "تم التسجيل بنجاح! يرجى تفعيل الحساب من الإيميل" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
    }
};

export const activate = async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        
        const user = await User.findOneAndUpdate(
            { email: decoded.email }, 
            { isActivated: true }, 
            { new: true }
        );

        if (!user) return res.status(404).send("<h1>المستخدم غير موجود</h1>");

        res.status(200).send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial;">
                <h1 style="color: #8a2be2;">تم تفعيل حسابك بنجاح يا ${user.userName}! 💜</h1>
                <p>يمكنك الآن العودة للتطبيق وتسجيل الدخول.</p>
            </div>
        `);
    } catch (error) {
        res.status(400).send("<h1>رابط التفعيل منتهي الصلاحية أو غير صحيح</h1>");
    }
};

export const login = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (email) {
            const user = await User.findOne({ email: email.toLowerCase() });

            if (!user) {
                return res.status(401).json({ message: "الإيميل ده مش موجود في السيستم أصلاً" });
            }

            if (!bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
            }

            if (!user.isActivated) {
                return res.status(403).json({ message: "يرجى انتظار تفعيل الحساب" });
            }

            const token = jwt.sign(
                { id: user._id, role: user.role, userName: user.userName }, 
                process.env.SECRET_KEY, 
                { expiresIn: '7d' }
            );

            let children = [];
            if (user.role === Role.PARENT) {
                children = await Child.find({ parentId: user._id }).select("-password");
            }

            return res.status(200).json({
                message: "تم تسجيل الدخول بنجاح 💜",
                token: `Sila__${token}`,
                user: { id: user._id, name: user.userName, role: user.role, children }
            });
        }

        if (name) {
            const child = await Child.findOne({ name });
            if (child && bcrypt.compareSync(password, child.password)) {
                const token = jwt.sign(
                    { id: child._id, role: "Child" }, 
                    process.env.SECRET_KEY, 
                    { expiresIn: '7d' }
                );
                return res.status(200).json({
                    message: "أهلاً بك يا بطل 💜",
                    token: `Sila__${token}`,
                    childData: { id: child._id, name: child.name, points: child.points, gender: child.gender, status: child.status }
                });
            }
        }

        res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في السيرفر", error: error.message });
    }
};