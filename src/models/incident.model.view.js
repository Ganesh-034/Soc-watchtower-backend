import mongoose from "mongoose";

const userCountSchema = new mongoose.Schema(
  {
    _id: String,
    userOid: String,
    date: String,
    count: Number,
    updatedAt: String,
    createdAt: String,
  },
  {
    collection: "usercount",
    timestamps: false,
  }
);

userCountSchema.index({ userOid: 1, date: 1 });
userCountSchema.index({ userOid: 1, updatedAt: -1 });

const UserCount = mongoose.model("UserCount", userCountSchema);

export default UserCount;