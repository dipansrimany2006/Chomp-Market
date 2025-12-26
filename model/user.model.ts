import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const userSchema = new Schema({
  email: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  walletAddress: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const User = models.User || model("User", userSchema);
export default User;
