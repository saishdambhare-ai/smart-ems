const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username:   { type: String, unique: true, required: true },
  password:   { type: String, required: true },
  first_name: { type: String, default: 'Admin' },
});

module.exports = mongoose.model('Admin', adminSchema);