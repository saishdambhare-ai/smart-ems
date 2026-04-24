const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  first_name:  { type: String, required: true },
  last_name:   { type: String, required: true },
  username:    { type: String, unique: true, required: true },
  email:       { type: String, required: true },
  phone:       { type: String, required: true },
  address:     { type: String, required: true },
  department:  { type: String, required: true },
  profession:  { type: String, required: true },
  password:    { type: String, required: true },
  experience:  { type: Number, default: 0 },       // ← NEW: years of experience
  login_count: { type: Number, default: 0 },       // ← NEW: login activity tracker
  last_login:  { type: Date },                     // ← NEW: last login timestamp
  created_at:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Employee', employeeSchema);