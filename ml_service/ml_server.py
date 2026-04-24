"""
ML Microservice — Employee Management System
=========================================
Run with:  python ml_server.py
Runs on:   http://127.0.0.1:5001

Endpoints:
  GET  /health             → service status
  POST /predict/salary     → { department, profession, experience } → { salary }
  POST /predict/attrition  → { department, profession, experience, login_activity } → { risk, probability }
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, r2_score
import os

app = Flask(__name__)
CORS(app)  # Allow requests from Node.js backend

# ── Category encodings (must match training data exactly) ─────────
DEPARTMENTS = ["IT", "Computer", "ENTC", "AIML"]
PROFESSIONS = ["Professor", "Lab Technician", "Administrative Staff", "Librarian"]

dept_enc = {d: i for i, d in enumerate(DEPARTMENTS)}
prof_enc = {p: i for i, p in enumerate(PROFESSIONS)}

def encode_features(dept, prof, exp, login=None):
    """Convert string inputs to numeric feature vector."""
    d = dept_enc.get(dept, 0)
    p = prof_enc.get(prof, 0)
    row = [d, p, float(exp)]
    if login is not None:
        row.append(float(login))
    return row

# ── Training ─────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.abspath(__file__))

def train_salary_model():
    csv_path = os.path.join(BASE, "salary_dataset.csv")
    if not os.path.exists(csv_path):
        print(f"❌ salary_dataset.csv not found at {csv_path}")
        print("   Run: python generate_dataset.py")
        return None

    df = pd.read_csv(csv_path)
    df["dept_enc"] = df["department"].map(dept_enc).fillna(0).astype(int)
    df["prof_enc"] = df["profession"].map(prof_enc).fillna(0).astype(int)

    X = df[["dept_enc", "prof_enc", "experience"]].values
    y = df["salary"].values

    model = LinearRegression()
    model.fit(X, y)
    score = r2_score(y, model.predict(X))
    print(f"✅ Salary model trained  →  R² = {score:.4f}")
    return model

def train_attrition_model():
    csv_path = os.path.join(BASE, "attrition_dataset.csv")
    if not os.path.exists(csv_path):
        print(f"❌ attrition_dataset.csv not found at {csv_path}")
        print("   Run: python generate_dataset.py")
        return None

    df = pd.read_csv(csv_path)
    df["dept_enc"] = df["department"].map(dept_enc).fillna(0).astype(int)
    df["prof_enc"] = df["profession"].map(prof_enc).fillna(0).astype(int)

    X = df[["dept_enc", "prof_enc", "experience", "login_activity"]].values
    y = df["attrition"].values

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)
    acc = accuracy_score(y, model.predict(X))
    print(f"✅ Attrition model trained  →  Accuracy = {acc:.4f}")
    return model

# Train both models at startup
print("\n🔧 Training ML models...")
salary_model    = train_salary_model()
attrition_model = train_attrition_model()

if salary_model and attrition_model:
    print("🚀 ML service ready!\n")
else:
    print("⚠️  Some models failed to load. Check CSV files.\n")

# ── Routes ────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "salary_model":    "loaded" if salary_model    else "error",
        "attrition_model": "loaded" if attrition_model else "error",
    })

@app.route("/predict/salary", methods=["POST"])
def predict_salary():
    if not salary_model:
        return jsonify({"error": "Salary model not loaded"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body received"}), 400

    try:
        department = data.get("department", "IT")
        profession = data.get("profession", "Professor")
        experience = float(data.get("experience", 0))

        row  = encode_features(department, profession, experience)
        pred = float(salary_model.predict([row])[0])
        pred = max(pred, 20000)  # floor at ₹20k

        return jsonify({
            "salary":     round(pred, 2),
            "monthly":    round(pred / 12, 2),
            "department": department,
            "profession": profession,
            "experience": experience,
        })
    except Exception as e:
        print(f"Salary prediction error: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/predict/attrition", methods=["POST"])
def predict_attrition():
    if not attrition_model:
        return jsonify({"error": "Attrition model not loaded"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body received"}), 400

    try:
        department     = data.get("department",     "IT")
        profession     = data.get("profession",     "Professor")
        experience     = float(data.get("experience",     0))
        login_activity = float(data.get("login_activity", 5))

        row         = encode_features(department, profession, experience, login_activity)
        probability = float(attrition_model.predict_proba([row])[0][1])
        risk        = "High" if probability >= 0.5 else ("Medium" if probability >= 0.3 else "Low")

        return jsonify({
            "probability": round(probability, 3),
            "risk":        risk,
            "department":  department,
            "profession":  profession,
        })
    except Exception as e:
        print(f"Attrition prediction error: {e}")
        return jsonify({"error": str(e)}), 400

# ── Start ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))  # default 5001 locally
    print(f"Starting ML service on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)