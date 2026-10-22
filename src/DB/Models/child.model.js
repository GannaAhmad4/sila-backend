import { Schema, model, Types } from "mongoose";

export const Gender = {
    MALE: "male",
    FEMALE: "female"
};

export const ChildStatus = {
    NORMAL: "normal",
    AUTISTIC: "autistic",
    SIGN_USER: "sign_user"
};

const childSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 30
    },
    age: {
        type: Number,
        required: true,
        min: 5,
        max: 15
    },
    gender: {
        type: String,
        enum: Object.values(Gender),
        required: true
    },
    status: {
        type: String,
        enum: Object.values(ChildStatus),
        default: ChildStatus.NORMAL
    },
    password: {
        type: String,
        required: true
    },
    parentId: {
        type: Types.ObjectId,
        ref: 'User', 
        required: true
    },
    points: {
        type: Number,
        default: 0
    },
    bonus: {
        type: Number,
        default: 0
    },
    streakCount: {
        type: Number,
        default: 0
    },
    mentalStatus: {
        type: String,
        enum: ["سعيد", "حزين", "متوتر", "خائف", "هادئ"],
        default: "هادئ"
    },
    lastLoginDate: {
        type: Date,
        default: null
    },
    awardedLessonQuestionKeys: [{
        type: String
    }],
    purchasedActivityGameIds: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    unlockedLevels: [{
        type: Types.ObjectId,
        ref: 'Category'
    }],
    profilePic: {
        type: String
    },
    // ✅ NEW: Video Progress Tracking
    watchedVideos: [{
        lessonId: {
            type: Types.ObjectId,
            ref: 'Lesson',
            required: true
        },
        itemId: {
            type: Types.ObjectId,
            required: true
        },
        percentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        isCompleted: {
            type: Boolean,
            default: false
        },
        watchedAt: {
            type: Date,
            default: Date.now
        },
        lastUpdatedAt: {
            type: Date,
            default: Date.now
        },
        _id: false
    }],
    // ✅ الكاتيجوريز اللي الطفل خلصها كاملة (للـ Level)
    completedCategories: {
        type: [String],
        enum: ["حروف", "أرقام", "كلمات", "جمل"],
        default: [],
        validate: {
          validator: function(v) {
            // ✅ لازم يكون مرتب: حروف → أرقام → كلمات → جمل
            const validOrder = ["حروف", "أرقام", "كلمات", "جمل"];
            const indices = v.map(cat => validOrder.indexOf(cat));
            
            // ✅ Check: معاش ترتيب بالعكس، ومعاش gaps
            for (let i = 0; i < v.length; i++) {
              if (indices[i] !== i) return false;
            }
            return true;
          },
          message: "الكاتجوريز لازم تكون بالترتيب: حروف → أرقام → كلمات → جمل"
        }
      },
    // ✅ NEW: Completed Lessons Tracking
    completedLessonItems: [{
        lessonId: {
            type: Types.ObjectId,
            ref: 'Lesson'
        },
        itemId: {
            type: Types.ObjectId
        },
        type: {
            type: String,
            enum: ['video', 'quiz']
        },
        completedAt: {
            type: Date,
            default: Date.now
        },
        _id: false
    }]
}, {
    timestamps: true
});

export const Child = model("Child", childSchema);