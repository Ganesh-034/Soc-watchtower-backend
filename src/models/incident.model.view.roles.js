import mongoose from "mongoose";

const rolesAccessSchema = new mongoose.Schema(
  {
    _id: String,
    userOid: String,
    Username: String,
    access: String,
  },
  {
    collection: "roles",
    timestamps: false,
  }
);

rolesAccessSchema.index({ userOid: 1, date: 1 });
rolesAccessSchema.index({ userOid: 1, updatedAt: -1 });

const RolesCount = mongoose.model("RolesCount", rolesAccessSchema);

export default RolesCount;