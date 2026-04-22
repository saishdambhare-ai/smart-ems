const mongoose = require('mongoose');

console.log("ENV VALUE:", process.env.MONGO_URI); // 🔥 DEBUG

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/emp_system";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));