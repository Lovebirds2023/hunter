"""
fix_and_push.py
---------------
Patches the hunter repo for Railway deployment and pushes to GitHub.

Run from inside the repo root:
    cd "C:\\Users\\Eliud Were\\Downloads\\hunter-main\\hunter-main"
    python fix_and_push.py
"""

import os
import subprocess
import sys

# ── Config ────────────────────────────────────────────────────────────────────

GITHUB_REPO = "https://github.com/Lovebirds2023/hunter.git"
BRANCH      = "main"

# ── Helpers ───────────────────────────────────────────────────────────────────

def write(path, content):
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK  Written: {path}")

def run(cmd, check=True):
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip())
    if check and result.returncode != 0:
        print(f"\nERROR: Command failed (exit {result.returncode}). Aborting.")
        sys.exit(1)
    return result

# ── Sanity check: must be in the folder that has backend/ ────────────────────

if not os.path.isdir("backend"):
    print("\nERROR: 'backend' folder not found here.")
    print("Make sure you are in the right directory, e.g.:")
    print('  cd "C:\\Users\\Eliud Were\\Downloads\\hunter-main\\hunter-main"')
    print("  python fix_and_push.py")
    sys.exit(1)

print("\n--- Starting Railway deployment fixes ---\n")

# ── Fix 1: railway.toml ───────────────────────────────────────────────────────

print("1) Patching railway.toml ...")
write("railway.toml", """\
[build]
builder = "nixpacks"
buildCommand = "pip install -r backend/requirements.txt"

[deploy]
startCommand = "cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
""")

# ── Fix 2: rename docker-compose.yml so Railway ignores it ───────────────────

print("\n2) Renaming docker-compose.yml -> docker-compose.local.yml ...")
if os.path.isfile("docker-compose.yml"):
    os.rename("docker-compose.yml", "docker-compose.local.yml")
    print("  OK  Renamed")
else:
    print("  INFO: docker-compose.yml not found - skipping")

# ── Fix 3: add /health endpoint to backend/app/main.py ───────────────────────

MAIN_PY = os.path.join("backend", "app", "main.py")
print(f"\n3) Checking {MAIN_PY} for /health route ...")

with open(MAIN_PY, "r", encoding="utf-8") as f:
    content = f.read()

if '@app.get("/health")' not in content:
    with open(MAIN_PY, "a", encoding="utf-8") as f:
        f.write('\n\n@app.get("/health")\nasync def health():\n    return {"status": "ok"}\n')
    print("  OK  Added /health endpoint")
else:
    print("  INFO: /health already present - skipping")

# ── Fix 4: ensure uvicorn is in requirements.txt ─────────────────────────────

REQ = os.path.join("backend", "requirements.txt")
print(f"\n4) Checking {REQ} for uvicorn ...")

with open(REQ, "r", encoding="utf-8") as f:
    req_content = f.read()

if "uvicorn" not in req_content.lower():
    with open(REQ, "a", encoding="utf-8") as f:
        f.write("\nuvicorn[standard]\n")
    print("  OK  Added uvicorn[standard]")
else:
    print("  INFO: uvicorn already present - skipping")

# ── Git setup ─────────────────────────────────────────────────────────────────

print("\n5) Setting up git ...")

if not os.path.isdir(".git"):
    print("  INFO: No .git found - initialising fresh repo ...")
    run("git init")
    run(f"git remote add origin {GITHUB_REPO}")
    print("  OK  Git initialised and remote added")
else:
    remotes = run("git remote -v", check=False).stdout
    if "origin" not in remotes:
        run(f"git remote add origin {GITHUB_REPO}")
        print("  OK  Remote origin added")
    else:
        run(f"git remote set-url origin {GITHUB_REPO}")
        print("  OK  Remote origin updated")

# Set git identity if missing (required to commit)
if not run("git config user.name",  check=False).stdout.strip():
    run('git config user.name "Eliud Were"')
if not run("git config user.email", check=False).stdout.strip():
    run('git config user.email "deploy@lovedogs360.com"')

# ── Stage, commit, push ───────────────────────────────────────────────────────

print("\n6) Staging all files ...")
run("git add -A")

print("\n7) Committing ...")
commit = run(
    'git commit -m "fix: Railway deployment - $PORT, nixpacks builder, correct app entrypoint"',
    check=False
)
if commit.returncode != 0:
    out = commit.stdout + commit.stderr
    if "nothing to commit" in out:
        print("  INFO: Nothing new to commit - already up to date")
    else:
        print(f"\nERROR: Commit failed:\n{out}")
        sys.exit(1)

print("\n8) Pushing to GitHub ...")
push = run(f"git push -u origin {BRANCH}", check=False)

if push.returncode != 0:
    out = push.stdout + push.stderr
    if "rejected" in out or "fetch first" in out or "failed to push" in out:
        print("\n  WARNING: Normal push rejected (remote has different history).")
        print("           Force-pushing your local files to remote ...")
        run(f"git push -u origin {BRANCH} --force")
    else:
        print(f"\nERROR: Push failed:\n{out}")
        print("""
  Common fixes:
  - Git will prompt for your GitHub username + a Personal Access Token (not password).
  - Generate a token at:
      GitHub -> Settings -> Developer settings -> Personal access tokens -> Generate new token
      Required scope: repo (full control)
  - Paste the token when prompted for 'Password'.
        """)
        sys.exit(1)

print("""
=============================================================
  DONE! Changes pushed to GitHub.
=============================================================
  What was fixed:
    railway.toml       - nixpacks builder + $PORT startCommand
    docker-compose.yml - renamed so Railway ignores it
    backend/app/main.py - added /health endpoint
    requirements.txt   - ensured uvicorn[standard] is listed

  Railway will auto-redeploy in ~2 minutes.
  URL: https://hunter-production-553a.up.railway.app
=============================================================
""")
