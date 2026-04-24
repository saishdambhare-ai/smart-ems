/**
 * setup_admin.js
 * ==============
 * Run ONCE to create the admin account in MongoDB.
 * 
 * Usage:
 *   node setup_admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin    = require('./models/Admin');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/emp_system';

async function setup() {
  console.log('\n🔧 EMS Admin Setup');
  console.log('==================');
  console.log('Connecting to MongoDB:', MONGO_URI, '\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected\n');

    // Delete existing admin (fresh setup)
    await Admin.deleteMany({});

    // Create admin
    const admin = new Admin({
      username:   'admin',
      password:   'admin123',
      first_name: 'Super Admin',
    });
    await admin.save();

    console.log('✅ Admin account created!');
    console.log('   Username : admin');
    console.log('   Password : admin123');
    console.log('   Role     : Admin\n');
    console.log('Now run: node server.js');
    console.log('Then visit: http://localhost:3000\n');

  } catch (err) {
    if (err.message.includes('ECONNREFUSED')) {
      console.error('❌ Cannot connect to MongoDB!');
      console.error('   Make sure MongoDB is running:');
      console.error('   Windows: Start MongoDB from Services (Win+R → services.msc)');
      console.error('   Or run:  mongod\n');
    } else {
      console.error('❌ Error:', err.message);
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

setup();