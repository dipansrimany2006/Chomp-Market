import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const commentSchema = new Schema({
  pollId: { type: String, required: true, index: true },
  walletAddress: { type: String, required: true, index: true },
  userName: { type: String }, // Optional display name
  content: { type: String, required: true, maxlength: 1000 },
  likes: [{ type: String }], // Array of wallet addresses who liked
  parentCommentId: { type: Schema.Types.ObjectId, ref: "Comment" }, // For replies
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for efficient querying
commentSchema.index({ pollId: 1, createdAt: -1 });

const Comment = models.Comment || model("Comment", commentSchema);
export default Comment;
