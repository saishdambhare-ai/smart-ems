require('dotenv').config();

const express    = require('express');
const path       = require('path');
const bodyParser = require('body-parser');
const session    = require('express-session');

const app    = express();
const PORT   = process.env.PORT   || 3000;
const ML_URL = process.env.ML_URL || 'http://127.0.0.1:5001';  // ← reads from .env

// ── DB + Models ──────────────────────────────────────────────────
require('./db/connection');
const Employee = require('./models/Employee');
const Admin    = require('./models/Admin');

// ── Middleware ───────────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ems_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }  // 2 hours
}));

// ── HTML Pages ───────────────────────────────────────────────────
const pub = (f) => (_, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/',                        pub('index.html'));
app.get('/login.html',              pub('login.html'));
app.get('/register.html',           pub('register.html'));
app.get('/admin.html',              pub('admin.html'));
app.get('/employee_dashboard.html', pub('employee_dashboard.html'));
app.get('/manage.html',             pub('manage.html'));
app.get('/update_employee.html',    pub('update_employee.html'));
app.get('/predict.html',            pub('predict.html'));

// ══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════

// ── Register ─────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, username, email, phone,
            address, department, profession, password, experience } = req.body;

    if (!first_name || !last_name || !username || !email || !password) {
      return res.send('<script>alert("All fields are required!"); window.location.href="/register.html";</script>');
    }

    const existing = await Employee.findOne({ username });
    if (existing) {
      return res.send('<script>alert("Username already exists! Please choose another."); window.location.href="/register.html";</script>');
    }

    const newEmp = new Employee({
      first_name, last_name, username, email,
      phone, address, department, profession, password,
      experience: Number(experience) || 0,
    });

    await newEmp.save();
    res.send('<script>alert("Registration Successful! Please login."); window.location.href="/login.html";</script>');
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      res.send('<script>alert("Username already exists!"); window.location.href="/register.html";</script>');
    } else {
      res.status(500).send('<script>alert("Server error. Please try again."); window.history.back();</script>');
    }
  }
});

// ── Login ─────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).send('Username, password, and role are required');
    }

    if (role === 'admin') {
      const admin = await Admin.findOne({ username, password });
      if (!admin) return res.status(401).send('Invalid admin credentials');
      req.session.user = { username, role: 'admin', name: admin.first_name };
      return res.status(200).send('Admin login successful');

    } else {
      const emp = await Employee.findOne({ username, password });
      if (!emp) return res.status(401).send('Invalid employee credentials');

      emp.login_count = (emp.login_count || 0) + 1;
      emp.last_login  = new Date();
      await emp.save();

      req.session.user = { username, role: 'employee', id: String(emp._id), name: emp.first_name };
      return res.status(200).send('Employee login successful');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error');
  }
});

// ── Logout ────────────────────────────────────────────────────────
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// ── Session Check ─────────────────────────────────────────────────
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ══════════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES
// ══════════════════════════════════════════════════════════════════

// ── Employee Dashboard Info ───────────────────────────────────────
app.get('/api/employee-info', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'employee') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const emp = await Employee.findById(req.session.user.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    res.json({
      first_name:  emp.first_name,
      last_name:   emp.last_name,
      department:  emp.department,
      profession:  emp.profession,
      experience:  emp.experience  || 0,
      login_count: emp.login_count || 0,
    });
  } catch (err) {
    console.error('Employee info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get All Employees ─────────────────────────────────────────────
app.get('/get_all_employees', async (req, res) => {
  try {
    const employees = await Employee.find().lean();
    res.json(employees.map(emp => ({
      id:          emp._id,
      first_name:  emp.first_name,
      last_name:   emp.last_name,
      username:    emp.username,
      email:       emp.email,
      phone:       emp.phone,
      address:     emp.address,
      department:  emp.department,
      profession:  emp.profession,
      experience:  emp.experience  || 0,
      login_count: emp.login_count || 0,
      created_at:  emp.created_at,
    })));
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Get Single Employee ───────────────────────────────────────────
app.get('/get_employee/:id', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (err) {
    console.error('Get employee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Update Employee ───────────────────────────────────────────────
app.put('/update_employee', async (req, res) => {
  try {
    const { id, first_name, last_name, username, email,
            phone, address, department, profession, experience } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'ID required' });

    const emp = await Employee.findById(id);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    emp.first_name  = first_name  || emp.first_name;
    emp.last_name   = last_name   || emp.last_name;
    emp.username    = username    || emp.username;
    emp.email       = email       || emp.email;
    emp.phone       = phone       || emp.phone;
    emp.address     = address     || emp.address;
    emp.department  = department  || emp.department;
    emp.profession  = profession  || emp.profession;
    emp.experience  = Number(experience) || emp.experience || 0;

    await emp.save();
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Username already taken' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// ── Delete Employee ───────────────────────────────────────────────
app.delete('/delete_employee/:id', async (req, res) => {
  try {
    const result = await Employee.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ML PREDICTION ROUTES (proxy → Python Flask on port 5001)
// ══════════════════════════════════════════════════════════════════

async function callML(endpoint, body) {
  const res = await fetch(`${ML_URL}${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(10000),  // 10 second timeout
  });
  return res.json();
}

// ── Health check for ML service ───────────────────────────────────
app.get('/api/ml-health', async (req, res) => {
  try {
    const r = await fetch(`${ML_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    res.json({ available: true, ...d });
  } catch (err) {
    res.json({ available: false, error: 'ML service not reachable' });
  }
});

// ── Salary Prediction ─────────────────────────────────────────────
app.post('/api/predict/salary', async (req, res) => {
  try {
    const { department, profession, experience } = req.body;
    if (!department || !profession || experience === undefined) {
      return res.status(400).json({ error: 'department, profession, experience required' });
    }
    const data = await callML('/predict/salary', {
      department, profession, experience: Number(experience)
    });
    res.json(data);
  } catch (err) {
    console.error('Salary prediction error:', err.message);
    res.status(503).json({ error: 'ML service unavailable. Start it with: python ml_service/ml_server.py' });
  }
});

// ── Attrition Prediction ──────────────────────────────────────────
app.post('/api/predict/attrition', async (req, res) => {
  try {
    const { department, profession, experience, login_activity } = req.body;
    if (!department || !profession || experience === undefined) {
      return res.status(400).json({ error: 'department, profession, experience required' });
    }
    const data = await callML('/predict/attrition', {
      department, profession,
      experience:     Number(experience),
      login_activity: Number(login_activity ?? 5),
    });
    res.json(data);
  } catch (err) {
    console.error('Attrition prediction error:', err.message);
    res.status(503).json({ error: 'ML service unavailable. Start it with: python ml_service/ml_server.py' });
  }
});

// ── Bulk Attrition Scan ───────────────────────────────────────────
app.get('/api/attrition-scan', async (req, res) => {
  try {
    const employees = await Employee.find().lean();

    if (employees.length === 0) {
      return res.json([]);
    }

    const results = [];
    for (const emp of employees) {
      try {
        const pred = await callML('/predict/attrition', {
          department:     emp.department  || 'IT',
          profession:     emp.profession  || 'Professor',
          experience:     emp.experience  || 0,
          login_activity: Math.min(emp.login_count || 5, 10),
        });
        results.push({
          id:          emp._id,
          name:        `${emp.first_name} ${emp.last_name}`,
          department:  emp.department,
          profession:  emp.profession,
          experience:  emp.experience || 0,
          risk:        pred.risk        || 'Unknown',
          probability: pred.probability || 0,
        });
      } catch (_) {
        // Skip individual failures silently
      }
    }

    results.sort((a, b) => b.probability - a.probability);
    res.json(results);

  } catch (err) {
    console.error('Attrition scan error:', err);
    res.status(500).json({ error: 'Server error during scan' });
  }
});

// ── Start Server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  🚀 EMS Server   → http://localhost:${PORT}   ║`);
  console.log(`║  🤖 ML Service   → ${ML_URL}  ║`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('  Admin login: username=admin  password=admin123');
  console.log('  Start ML:    python ml_service/ml_server.py\n');
});
