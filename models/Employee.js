const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  first_name:    String,
  last_name:     String,
  username:      { type: String, unique: true },
  email:         String,
  phone:         String,
  address:       String,
  department:    String,
  profession:    String,
  password:      String,
  experience:    { type: Number, default: 0 },   // years of experience (NEW)
  login_count:   { type: Number, default: 0 },   // tracks weekly logins (NEW)
  last_login:    { type: Date },                  // last login timestamp (NEW)
  created_at:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', employeeSchema);
