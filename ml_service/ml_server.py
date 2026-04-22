"""
ML Microservice — Employee Management System
Runs on port 5001, called by Node.js server.js

Endpoints:
  POST /predict/salary     → { department, profession, experience } → { salary }
  POST /predict/attrition  → { department, profession, experience, login_activity } → { risk, probability }
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, r2_score
import os, json

app = Flask(__name__)
CORS(app)

# ── Encode categoricals ──────────────────────────────────────────
DEPARTMENTS  = ["IT", "Computer", "ENTC", "AIML"]
PROFESSIONS  = ["Professor", "Lab Technician", "Administrative Staff", "Librarian"]

dept_enc  = {d: i for i, d in enumerate(DEPARTMENTS)}
prof_enc  = {p: i for i, p in enumerate(PROFESSIONS)}


def encode_row(dept, prof, exp, login=None):
    row = [dept_enc.get(dept, 0), prof_enc.get(prof, 0), float(exp)]
    if login is not None:
        row.append(float(login))
    return row


# ── Train models at startup ──────────────────────────────────────
BASE = os.path.dirname(__file__)

def train_salary_model():
    df = pd.read_csv(os.path.join(BASE, "salary_dataset.csv"))
    df["dept_enc"] = df["department"].map(dept_enc)
    df["prof_enc"] = df["profession"].map(prof_enc)
    X = df[["dept_enc", "prof_enc", "experience"]].values
    y = df["salary"].values
    model = LinearRegression()
    model.fit(X, y)
    score = r2_score(y, model.predict(X))
    print(f"✅ Salary model R² = {score:.3f}")
    return model

def train_attrition_model():
    df = pd.read_csv(os.path.join(BASE, "attrition_dataset.csv"))
    df["dept_enc"] = df["department"].map(dept_enc)
    df["prof_enc"] = df["profession"].map(prof_enc)
    X = df[["dept_enc", "prof_enc", "experience", "login_activity"]].values
    y = df["attrition"].values
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)
    acc = accuracy_score(y, model.predict(X))
    print(f"✅ Attrition model Accuracy = {acc:.3f}")
    return model

salary_model    = train_salary_model()
attrition_model = train_attrition_model()
print("🚀 ML models ready")


# ── Routes ───────────────────────────────────────────────────────
@app.route("/predict/salary", methods=["POST"])
def predict_salary():
    data = request.get_json()
    try:
        row = encode_row(data["department"], data["profession"], data["experience"])
        pred = salary_model.predict([row])[0]
        return jsonify({ "salary": round(float(pred), 2) })
    except Exception as e:
        return jsonify({ "error": str(e) }), 400


@app.route("/predict/attrition", methods=["POST"])
def predict_attrition():
    data = request.get_json()
    try:
        row = encode_row(
            data["department"], data["profession"],
            data["experience"], data.get("login_activity", 5)
        )
        prob  = attrition_model.predict_proba([row])[0][1]
        risk  = "High" if prob >= 0.5 else ("Medium" if prob >= 0.3 else "Low")
        return jsonify({ "probability": round(float(prob), 3), "risk": risk })
    except Exception as e:
        return jsonify({ "error": str(e) }), 400


@app.route("/health")
def health():
    return jsonify({ "status": "ok" })


import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)