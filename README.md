# Employee Management System — Complete Setup Guide

## Project Structure

```
emp_project/
├── server.js                    ← Main Node.js server (port 3050)
├── package.json                 ← Node.js dependencies
├── db/
│   └── connection.js            ← MongoDB connection
├── models/
│   ├── Employee.js              ← Employee schema (with experience, login_count)
│   └── Admin.js                 ← Admin schema
├── public/                      ← All frontend HTML files
│   ├── index.html               ← Landing page
│   ├── login.html               ← Login (dark theme + role toggle)
│   ├── register.html            ← Register (with experience field)
│   ├── admin.html               ← Admin dashboard (sidebar + live stats)
│   ├── manage.html              ← Manage employees (search + table)
│   ├── update_employee.html     ← Edit employee form
│   ├── employee_dashboard.html  ← Employee portal (with ML results)
│   └── predict.html             ← ML Predictions page (salary + attrition)
└── ml_service/
    ├── ml_server.py             ← Flask ML microservice (port 5001)
    ├── requirements.txt         ← Python dependencies
    ├── generate_dataset.py      ← Dataset generator script
    ├── salary_dataset.csv       ← 500-row salary training data
    └── attrition_dataset.csv    ← 500-row attrition training data
```

---

## Requirements

### System Requirements
- **Node.js** v18 or above — https://nodejs.org
- **MongoDB** v6 or above — https://www.mongodb.com/try/download/community
- **Python** 3.9 or above — https://python.org

---

## Step-by-Step Setup

### Step 1 — Install Node.js Dependencies

Open terminal in your project root folder (`emp_project/`):

```bash
npm install
```

This installs: `express`, `mongoose`, `express-session`, `body-parser`, `bcrypt`

Your `package.json` should have:
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^8.0.0",
    "express-session": "^1.18.0",
    "body-parser": "^1.20.0",
    "bcrypt": "^5.1.1"
  }
}
```

---

### Step 2 — Start MongoDB

**Windows:**
```bash
# If MongoDB is installed as a service, it's already running.
# Otherwise run:
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe"
```

**macOS / Linux:**
```bash
mongod --dbpath /data/db
# Or if installed via Homebrew:
brew services start mongodb-community
```

MongoDB runs on `mongodb://127.0.0.1:27017` by default.
The database name used is `emp_system` (created automatically).

---

### Step 3 — Create an Admin Account in MongoDB

The system uses session-based login. You need to manually insert an admin record.

Open MongoDB shell:
```bash
mongosh
```

Then run:
```js
use emp_system

db.admins.insertOne({
  username: "admin",
  password: "admin123",
  first_name: "Super Admin"
})
```

> ⚠️ Note: Passwords are stored in plain text in this project. For production, use bcrypt hashing.

---

### Step 4 — Set Up Python ML Service

Navigate to the `ml_service/` folder:

```bash
cd ml_service
```

Create a virtual environment (recommended):
```bash
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Generate the training datasets (only needed once):
```bash
python generate_dataset.py
```

This creates:
- `salary_dataset.csv` — 500 rows for Linear Regression
- `attrition_dataset.csv` — 500 rows for Random Forest

---

### Step 5 — Start the ML Service

From inside `ml_service/` with the venv activated:

```bash
python ml_server.py
```

You should see:
```
✅ Salary model R² = 0.97x
✅ Attrition model Accuracy = 0.8xx
🚀 ML models ready
 * Running on http://127.0.0.1:5001
```

Keep this terminal open.

---

### Step 6 — Start the Node.js Server

Open a **new terminal** in the project root:

```bash
node server.js
```

You should see:
```
✅ MongoDB connected successfully
🚀 EMS Server  →  http://localhost:3050
📊 ML Service  →  http://localhost:5001
```

---

### Step 7 — Open the App

Visit in your browser:
```
http://localhost:3050
```

---

## How to Use the Application

### Admin Login
- Go to `http://localhost:3050/login.html`
- Select **Admin** tab
- Username: `admin`, Password: `admin123`
- Redirected to Admin Dashboard

### Admin Features
| Feature | Location |
|---|---|
| View total/active employees | Admin Dashboard |
| Run attrition risk scan | Admin Dashboard → "Run Scan" |
| Add employee | Register page |
| Edit / delete employees | Manage Employees |
| Salary prediction tool | ML Predictions page |
| Attrition prediction tool | ML Predictions page |

### Employee Login
- Go to `http://localhost:3050/login.html`
- Select **Employee** tab
- Use credentials created during registration
- See their department, salary prediction, and retention status

---

## ML Models Explained

### 1. Salary Prediction — Linear Regression

**Input features:**
- `department` (encoded: IT=0, Computer=1, ENTC=2, AIML=3)
- `profession` (encoded: Professor=0, Lab Tech=1, Admin=2, Librarian=3)
- `experience` (years, 0–30)

**How it works:**
- Base salary per dept (IT: ₹70k, AIML: ₹75k, etc.)
- Multiplied by profession factor (Professor: 1.4×, Lab Tech: 1.0×, etc.)
- Grows ~3% per year of experience
- Model trained on 500 synthetic samples

**API:**
```
POST /api/predict/salary
Body: { "department": "IT", "profession": "Professor", "experience": 5 }
Response: { "salary": 98500.00 }
```

---

### 2. Attrition Prediction — Random Forest Classifier

**Input features:**
- `department`, `profession`, `experience`, `login_activity` (sessions/week)

**Risk levels:**
- 🔴 **High** — probability ≥ 50%
- 🟡 **Medium** — probability 30–49%
- 🟢 **Low** — probability < 30%

**What increases risk:**
- Experience < 2 years (+25%)
- Salary below department average (+20%)
- Login activity < 3/week (+20%)
- Role mismatch (e.g. Lab Tech in IT/AIML dept) (+15%)

**API:**
```
POST /api/predict/attrition
Body: { "department": "IT", "profession": "Lab Technician", "experience": 1, "login_activity": 2 }
Response: { "risk": "High", "probability": 0.78 }
```

---

### 3. Bulk Attrition Scan (Admin)

Admin dashboard has a "Run Scan" button that:
1. Fetches all employees from MongoDB
2. Sends each to the ML service
3. Displays a sorted table of risk levels
4. Updates the "High Risk" counter card

**API:**
```
GET /api/attrition-scan
Response: [{ id, name, department, profession, risk, probability }, ...]
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Cannot connect to MongoDB` | Make sure `mongod` is running |
| `ML service unavailable` | Run `python ml_service/ml_server.py` in a separate terminal |
| `Invalid admin credentials` | Insert admin record via mongosh (Step 3) |
| `fetch is not defined` error in server.js | Use Node.js v18+ (has native fetch) |
| Port 3050 already in use | Change `PORT` in server.js to 3051 or any free port |
| `ModuleNotFoundError` in Python | Run `pip install -r requirements.txt` inside ml_service/ |

---

## Running Both Services (Quick Start Script)

**Windows — `start.bat`:**
```bat
@echo off
start "ML Service" cmd /k "cd ml_service && python ml_server.py"
timeout /t 3
start "Node Server" cmd /k "node server.js"
```

**macOS/Linux — `start.sh`:**
```bash
#!/bin/bash
cd ml_service && python ml_server.py &
sleep 2
cd ..
node server.js
```

Make it executable: `chmod +x start.sh`, then run: `./start.sh`

---

## Summary of All API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/register` | Register new employee |
| POST | `/login` | Admin or employee login |
| GET | `/logout` | Destroy session |
| GET | `/api/employee-info` | Get logged-in employee's info |
| GET | `/get_all_employees` | Get all employees (admin) |
| GET | `/get_employee/:id` | Get single employee |
| PUT | `/update_employee` | Update employee record |
| DELETE | `/delete_employee/:id` | Delete employee |
| POST | `/api/predict/salary` | Salary prediction (ML) |
| POST | `/api/predict/attrition` | Attrition prediction (ML) |
| GET | `/api/attrition-scan` | Bulk attrition scan (admin) |
