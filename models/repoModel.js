const mongoose = require("mongoose");
const { Schema } = mongoose;

const RepositorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  content: [
    {
      name: { type: String, required: true }, // File or directory name
      type: { type: String, enum: ["file", "directory"], required: true }, // Type of item
      path: { type: String, required: true }, // Relative path in S3
      url: { type: String },
    },
  ],
  visibility: {
    type: String,
    enum: ["public", "private"],
    required: true,
    default: "public",
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  issues: [
    {
      type: String,
    },
  ],
},{ timestamps: true });

const Repository = mongoose.model("Repository", RepositorySchema);
module.exports = Repository;
