import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const watchlistSchema = new Schema({
  walletAddress: { type: String, required: true, index: true },
  pollId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for efficient queries and uniqueness
watchlistSchema.index({ walletAddress: 1, pollId: 1 }, { unique: true });

const Watchlist = models.Watchlist || model("Watchlist", watchlistSchema);
export default Watchlist;
