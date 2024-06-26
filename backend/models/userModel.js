const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    receivingEmail: {
      type: Boolean,
      default: true,
    },
    passwordResetToken: {
      token: {
        type: String,
      },
      expiresAt: {
        type: Date,
      },
    },
    avatar: {
      type: String,
      default:
        "http://res.cloudinary.com/drlztlr1m/image/upload/v1706979188/oxbsppubd3rsabqwfxsr.jpg",
    },
    banner: {
      type: String,
      default:
        "https://res.cloudinary.com/drlztlr1m/image/upload/v1713796393/bb2cvwoyx71um5cp9cxn.jpg",
    },
    isDisabled: {
      type: Number,
      default: 0,
      enum: [0, 1],
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin", "om", "superadmin"],
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    verification: {
      code: {
        type: String,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },
    registeredDeviceToken: {
      type: String,
      default: null,
    },
    otpRequired: {
      type: Boolean,
      default: false,
    },
    toRate: {
      type: Number,
      default: 0,
    },
    hasOnboard: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.statics.deleteUserWithCascade = async function (userId) {
  const user = await this.findById(userId);
  if (user) {
    await mongoose.model("Reservation").deleteMany({ user: userId });
    await user.deleteOne();
  }
};

module.exports = mongoose.model("User", userSchema);
