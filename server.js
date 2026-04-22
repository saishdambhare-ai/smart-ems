const express      = require('express');
const path         = require('path');
const bodyParser   = require('body-parser');
const session      = require('express-session');

const app  = express();
const PORT = 3050;
const ML_URL = 'http://127.0.0.1:5001'; // Python ML microservice

// ── DB + Models ──────────────────────────────────────────────────
require('./db/connection');
const Employee = require('./models/Employee');
const Admin    = require('./models/Admin');

// ── Middleware ───────────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'ems_secret_key',
  resave: false,
  saveUninitialized: true,
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

// ── Register ─────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, username, email, phone, address,
            department, profession, password } = req.body;

    if (await Employee.findOne({ username }))
      return res.send('<script>alert("Username already exists!"); window.location.href="/register.html";</script>');

    await new Employee({ first_name, last_name, username, email,
                         phone, address, department, profession, password }).save();
    res.send('<script>alert("Registration Successful!"); window.location.href="/login.html";</script>');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Error registering employee.');
  }
});

// ── Login ─────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (role === 'admin') {
      const admin = await Admin.findOne({ username, password });
      if (!admin) return res.status(401).send('Invalid admin credentials');
      req.session.user = { username, role: 'admin' };
      return res.status(200).send('Admin login successful');
    } else {
      const emp = await Employee.findOne({ username, password });
      if (!emp) return res.status(401).send('Invalid employee credentials');

      // Track login activity
      emp.login_count = (emp.login_count || 0) + 1;
      emp.last_login  = new Date();
      await emp.save();

      req.session.user = { username, role: 'employee', id: emp._id };
      return res.status(200).send('Employee login successful');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error');
  }
});

// ── Logout ────────────────────────────────────────────────────────
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

// ── Employee Dashboard Info ───────────────────────────────────────
app.get('/api/employee-info', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'employee')
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const emp = await Employee.findById(req.session.user.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    res.json({
      first_name:    emp.first_name,
      last_name:     emp.last_name,
      department:    emp.department,
      profession:    emp.profession,
      experience:    emp.experience || 0,
      login_count:   emp.login_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get All Employees ─────────────────────────────────────────────
app.get('/get_all_employees', async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees.map(emp => ({
      id:           emp._id,
      first_name:   emp.first_name,
      last_name:    emp.last_name,
      username:     emp.username,
      email:        emp.email,
      phone:        emp.phone,
      address:      emp.address,
      department:   emp.department,
      profession:   emp.profession,
      experience:   emp.experience || 0,
      login_count:  emp.login_count || 0,
      created_at:   emp.created_at,
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Get Single Employee ───────────────────────────────────────────
app.get('/get_employee/:id', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Update Employee ───────────────────────────────────────────────
app.put('/update_employee', async (req, res) => {
  try {
    const { id, first_name, last_name, username, email, phone,
            address, department, profession, experience } = req.body;
    const emp = await Employee.findById(id);
    if (!emp) return res.status(404).json({ success: false, message: 'Not found' });

    Object.assign(emp, { first_name, last_name, username, email,
                         phone, address, department, profession,
                         experience: Number(experience) || 0 });
    await emp.save();
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Delete Employee ───────────────────────────────────────────────
app.delete('/delete_employee/:id', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ success: false, message: 'Not found' });
    await Employee.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ML PREDICTION ROUTES  (proxy to Python ML microservice)
// ═══════════════════════════════════════════════════════════════════

// ── Salary Prediction ─────────────────────────────────────────────
app.post('/api/predict/salary', async (req, res) => {
  try {
    const { department, profession, experience } = req.body;
    if (!department || !profession || experience === undefined)
      return res.status(400).json({ error: 'department, profession, experience required' });

    const mlRes  = await fetch(`${ML_URL}/predict/salary`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ department, profession, experience: Number(experience) }),
    });
    const data = await mlRes.json();
    res.json(data);
  } catch (err) {
    console.error('Salary prediction error:', err);
    res.status(500).json({ error: 'ML service unavailable. Make sure ml_server.py is running.' });
  }
});

// ── Attrition Prediction ──────────────────────────────────────────
app.post('/api/predict/attrition', async (req, res) => {
  try {
    const { department, profession, experience, login_activity } = req.body;
    if (!department || !profession || experience === undefined)
      return res.status(400).json({ error: 'department, profession, experience required' });

    const mlRes = await fetch(`${ML_URL}/predict/attrition`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        department, profession,
        experience:     Number(experience),
        login_activity: Number(login_activity || 5),
      }),
    });
    const data = await mlRes.json();
    res.json(data);
  } catch (err) {
    console.error('Attrition prediction error:', err);
    res.status(500).json({ error: 'ML service unavailable. Make sure ml_server.py is running.' });
  }
});

// ── Bulk Attrition Scan (for admin dashboard) ─────────────────────
app.get('/api/attrition-scan', async (req, res) => {
  try {
    const employees = await Employee.find();
    const results = [];

    for (const emp of employees) {
      try {
        const mlRes = await fetch(`${ML_URL}/predict/attrition`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department:     emp.department,
            profession:     emp.profession,
            experience:     emp.experience || 1,
            login_activity: emp.login_count ? Math.min(emp.login_count, 10) : 5,
          }),
        });
        const pred = await mlRes.json();
        results.push({
          id:         emp._id,
          name:       `${emp.first_name} ${emp.last_name}`,
          department: emp.department,
          profession: emp.profession,
          risk:       pred.risk,
          probability: pred.probability,
        });
      } catch (_) {
        // skip individual failure
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 EMS Server  →  http://localhost:${PORT}`);
  console.log(`📊 ML Service  →  http://localhost:5001  (start with: python ml_service/ml_server.py)`);
});
