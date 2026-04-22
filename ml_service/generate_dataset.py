"""
Employee Dataset Generator
Generates synthetic training data for:
1. Salary Prediction (Linear Regression)
2. Attrition Prediction (Logistic Regression / Random Forest)
"""

import csv
import random
import math

random.seed(42)

# ── Base salary config ──────────────────────────────────────────
DEPT_BASE = {
    "IT":       70000,
    "Computer": 65000,
    "ENTC":     60000,
    "AIML":     75000,
}

PROF_MULTIPLIER = {
    "Professor":            1.4,
    "Lab Technician":       1.0,
    "Administrative Staff": 0.9,
    "Librarian":            0.85,
}

departments  = list(DEPT_BASE.keys())
professions  = list(PROF_MULTIPLIER.keys())

# ── Attrition risk factors ───────────────────────────────────────
def attrition_prob(dept, prof, exp, salary, login_activity):
    """
    Higher probability of attrition if:
    - Low experience (< 2 yrs)
    - Low salary compared to dept average
    - Low login activity
    - Certain dept/prof combos
    """
    base = 0.15

    if exp < 2:
        base += 0.25
    elif exp < 5:
        base += 0.10

    dept_avg = DEPT_BASE[dept] * PROF_MULTIPLIER[prof]
    if salary < dept_avg * 0.9:
        base += 0.20

    if login_activity < 3:
        base += 0.20
    elif login_activity < 7:
        base += 0.10

    if dept in ["IT", "AIML"] and prof == "Lab Technician":
        base += 0.15  # mismatch → higher attrition

    return min(base, 0.95)


# ── Generate dataset ─────────────────────────────────────────────
def generate_dataset(n=500):
    rows = []
    for i in range(n):
        dept       = random.choice(departments)
        prof       = random.choice(professions)
        exp        = round(random.uniform(0.5, 30), 1)   # years
        login_act  = random.randint(0, 10)               # logins/week avg

        base_sal   = DEPT_BASE[dept] * PROF_MULTIPLIER[prof]
        # Salary grows ~3 % per year of experience + noise
        salary     = base_sal * (1 + 0.03 * exp) + random.gauss(0, 3000)
        salary     = max(20000, round(salary, 2))

        prob_attr  = attrition_prob(dept, prof, exp, salary, login_act)
        attrition  = 1 if random.random() < prob_attr else 0

        rows.append({
            "department":     dept,
            "profession":     prof,
            "experience":     exp,
            "login_activity": login_act,
            "salary":         salary,
            "attrition":      attrition,
        })
    return rows


if __name__ == "__main__":
    data = generate_dataset(500)

    salary_fields    = ["department", "profession", "experience", "salary"]
    attrition_fields = ["department", "profession", "experience", "login_activity", "attrition"]

    with open("salary_dataset.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=salary_fields)
        w.writeheader()
        for r in data:
            w.writerow({k: r[k] for k in salary_fields})

    with open("attrition_dataset.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=attrition_fields)
        w.writeheader()
        for r in data:
            w.writerow({k: r[k] for k in attrition_fields})

    print(f"✅ Generated {len(data)} rows")
    print("   salary_dataset.csv    ← for salary prediction")
    print("   attrition_dataset.csv ← for attrition prediction")

    # Quick stats
    attr = sum(r["attrition"] for r in data)
    print(f"\n   Attrition rate: {attr}/{len(data)} ({attr/len(data)*100:.1f}%)")
    print(f"   Avg salary: ₹{sum(r['salary'] for r in data)/len(data):,.0f}")
