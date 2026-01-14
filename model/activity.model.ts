import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const activitySchema = new Schema({
  pollId: { type: String, required: true, index: true },
  walletAddress: { type: String, required: true, index: true },
  userName: { type: String }, // Optional display name
  action: {
    type: String,
    enum: ["bought", "sold", "claimed", "created"],
    required: true
  },
  optionIndex: { type: Number }, // Which option was bought/sold
  optionLabel: { type: String }, // Label of the option
  amount: { type: String, required: true }, // Amount in MNT (stored as string for precision)
  txHash: { type: String, index: true }, // Transaction hash for verification
  createdAt: { type: Date, default: Date.now },
});

// Index for efficient querying
activitySchema.index({ pollId: 1, createdAt: -1 });
activitySchema.index({ walletAddress: 1, createdAt: -1 });

const Activity = models.Activity || model("Activity", activitySchema);
export default Activity;
