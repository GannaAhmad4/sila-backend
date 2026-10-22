import { Schema, model } from "mongoose";

export const Role = {
    ADMIN: "Admin",
    PARENT: "Parent",
    SUPERADMIN: "superAdmin" 
};

const userSchema = new Schema({
    userName: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please fill a valid email address"]
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    phoneNumber: {
        type: String,
        required: true
    },

    role: {
        type: String,
        enum: Object.values(Role),
        default: Role.PARENT
    },
    isActivated: {
        type: Boolean,
        default: false
    },
    profilePic: {
        type: String
    }
}, {
    timestamps: true
});

export const User = model("User", userSchema);