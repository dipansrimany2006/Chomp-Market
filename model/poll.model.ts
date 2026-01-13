import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const pollSchema = new Schema({
  creatorWalletAddress: { type: String, required: true, index: true },
  question: { type: String, required: true },
  category: { type: String, required: true, index: true },
  resolutionCriteria: { type: String, required: true },
  resolutionSource: { type: String },
  image: { type: String }, // Base64 encoded image or URL

  // Custom options (2-4 required)
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v: string[]) {
        return v.length >= 2 && v.length <= 4;
      },
      message: 'Must have 2-4 options'
    }
  },

  // Track winning options (array of indices)
  winningOptionIndices: { type: [Number], default: [] },

  pollEnd: { type: Date, required: true },

  // Odds per option (percentage, replaces yesPrice/noPrice)
  odds: { type: [Number] },

  totalVolume: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "resolved", "cancelled"], default: "active", index: true },
  contractAddress: { type: String, index: true }, // On-chain market contract address
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Poll = models.Poll || model("Poll", pollSchema);
export default Poll;
