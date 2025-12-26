import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  createdBy: { type: String }, // Wallet address of creator
  createdAt: { type: Date, default: Date.now },
});

const Category = models.Category || model("Category", categorySchema);
export default Category;
