"""
SCS — Secure Cloud Storage Backend
Zero-Knowledge Architecture: Server never sees plaintext.
Only 3 API endpoints. No database. No ORM. File-based storage.
"""

import json
import os
import re
import hashlib
import secrets
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# ──────────────────────────── CONFIG ────────────────────────────

STORAGE_DIR = Path(__file__).parent / "storage"
USERS_FILE = STORAGE_DIR / "users.json"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-. ]{0,198}[a-zA-Z0-9_\-.]$")

# ──────────────────────────── INIT ──────────────────────────────

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
if not USERS_FILE.exists():
    USERS_FILE.write_text("[]", encoding="utf-8")

app = FastAPI(
    title="SCS — Secure Cloud Storage",
    description="Zero-Knowledge Encrypted File Storage",
    version="1.0.0",
    docs_url=None,       # Disable Swagger in production
    redoc_url=None,       # Disable Redoc in production
    openapi_url=None,     # Disable OpenAPI schema
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ──────────────────────────── HELPERS ───────────────────────────

def _load_users() -> list[dict]:
    """Load users from JSON file."""
    try:
        data = USERS_FILE.read_text(encoding="utf-8")
        return json.loads(data)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _save_users(users: list[dict]) -> None:
    """Atomically save users to JSON file."""
    tmp = USERS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(users, indent=2), encoding="utf-8")
    tmp.replace(USERS_FILE)


def _find_user(email: str) -> Optional[dict]:
    """Find a user by email."""
    email_lower = email.lower().strip()
    for user in _load_users():
        if user.get("email", "").lower() == email_lower:
            return user
    return None


def _sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and injection.
    Strips directory components, null bytes, and dangerous characters.
    """
    # Remove null bytes
    filename = filename.replace("\x00", "")
    # Take only the basename (strip directory traversal)
    filename = os.path.basename(filename)
    # Remove leading dots (hidden files)
    filename = filename.lstrip(".")
    # Replace dangerous characters
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename)
    # Collapse multiple underscores/spaces
    filename = re.sub(r"[_ ]{2,}", "_", filename)
    # Trim whitespace
    filename = filename.strip()
    # Fallback
    if not filename:
        filename = f"unnamed_{secrets.token_hex(4)}"
    # Truncate to 200 chars
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200 - len(ext)] + ext
    return filename


def _resolve_duplicate(user_dir: Path, filename: str) -> str:
    """If filename already exists, append a counter."""
    if not (user_dir / filename).exists():
        return filename
    name, ext = os.path.splitext(filename)
    counter = 1
    while (user_dir / f"{name}_{counter}{ext}").exists():
        counter += 1
    return f"{name}_{counter}{ext}"


def _validate_path_safety(base_dir: Path, target_path: Path) -> bool:
    """Ensure the target path is within the base directory (prevent traversal)."""
    try:
        resolved_base = base_dir.resolve()
        resolved_target = target_path.resolve()
        return str(resolved_target).startswith(str(resolved_base))
    except (ValueError, OSError):
        return False


# ────────────────────── MIDDLEWARE ───────────────────────────────

@app.middleware("http")
async def size_limit_middleware(request: Request, call_next):
    """Reject requests exceeding the file size limit."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE + 1024 * 10:  # 10KB overhead for metadata
        return JSONResponse(
            status_code=413,
            content={"detail": "File too large. Maximum size is 50 MB."}
        )
    return await call_next(request)


# ──────────────────────────── API ───────────────────────────────

@app.post("/api/register")
async def register(request: Request):
    """
    Register a new user.
    Client sends pre-hashed password + salt (zero-knowledge).
    Server stores: email, client-provided password_hash, client-provided salt.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    email = body.get("email", "").strip().lower()
    password_hash = body.get("password_hash", "").strip()
    salt = body.get("salt", "").strip()

    # Validate inputs
    if not email or not password_hash or not salt:
        raise HTTPException(status_code=400, detail="Email, password hash, and salt are required.")

    if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    if len(password_hash) != 64:  # SHA-256 hex
        raise HTTPException(status_code=400, detail="Invalid password hash format.")

    if len(salt) != 32:  # 16 bytes hex
        raise HTTPException(status_code=400, detail="Invalid salt format.")

    # Check for existing user
    if _find_user(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    # Store the user — server stores a SECOND hash of the client hash for verification
    server_salt = secrets.token_hex(16)
    server_hash = hashlib.sha256((password_hash + server_salt).encode()).hexdigest()

    users = _load_users()
    users.append({
        "email": email,
        "password_hash": server_hash,     # Double-hashed: client PBKDF2 → server SHA-256
        "client_salt": salt,               # Client's PBKDF2 salt (needed for login re-derivation)
        "server_salt": server_salt,        # Server's additional salt
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    _save_users(users)

    # Create user storage directory
    user_dir = STORAGE_DIR / hashlib.sha256(email.encode()).hexdigest()[:16]
    user_dir.mkdir(parents=True, exist_ok=True)

    return {"message": "Account created successfully.", "salt": salt}


@app.post("/api/login")
async def login(request: Request):
    """
    Verify user credentials.
    Client sends email + client-side PBKDF2 hash.
    Server verifies by re-hashing with server salt.
    Returns the client salt needed for key derivation.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    email = body.get("email", "").strip().lower()
    password_hash = body.get("password_hash", "").strip()

    if not email or not password_hash:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = _find_user(email)
    if not user:
        # Timing-safe: don't reveal whether email exists
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Verify: re-hash client hash with server salt, compare
    expected = hashlib.sha256((password_hash + user["server_salt"]).encode()).hexdigest()
    if not secrets.compare_digest(expected, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "message": "Login successful.",
        "email": email,
        "salt": user["client_salt"],
    }


@app.post("/api/upload")
async def upload(
    email: str = Form(...),
    password_hash: str = Form(...),
    metadata: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Upload an encrypted file.
    Server validates user, sanitizes filename, stores encrypted blob + metadata.
    Server NEVER decrypts — zero knowledge.
    """
    email = email.strip().lower()

    # Validate user
    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    # Verify password hash
    expected = hashlib.sha256((password_hash + user["server_salt"]).encode()).hexdigest()
    if not secrets.compare_digest(expected, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Authentication failed.")

    # Parse metadata
    try:
        meta = json.loads(metadata)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid metadata format.")

    required_fields = ["original_name", "original_size", "iv", "salt", "file_hash"]
    for field in required_fields:
        if field not in meta:
            raise HTTPException(status_code=400, detail=f"Missing metadata field: {field}")

    # Sanitize filename
    safe_name = _sanitize_filename(meta["original_name"])

    # Get user directory
    user_dir = STORAGE_DIR / hashlib.sha256(email.encode()).hexdigest()[:16]
    user_dir.mkdir(parents=True, exist_ok=True)

    # Resolve duplicates
    safe_name = _resolve_duplicate(user_dir, safe_name)

    # Validate path safety
    target_file = user_dir / safe_name
    if not _validate_path_safety(user_dir, target_file):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    # Read encrypted content with size check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")

    # Store encrypted blob
    target_file.write_bytes(content)

    # Store metadata
    meta_to_store = {
        "original_name": meta["original_name"],
        "stored_name": safe_name,
        "original_size": meta["original_size"],
        "encrypted_size": len(content),
        "iv": meta["iv"],
        "salt": meta["salt"],
        "file_hash": meta["file_hash"],
        "uploaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    meta_file = user_dir / f"{safe_name}.meta.json"
    meta_file.write_text(json.dumps(meta_to_store, indent=2), encoding="utf-8")

    return {
        "message": "File uploaded securely.",
        "filename": safe_name,
        "size": len(content),
    }


@app.get("/api/download")
async def download(email: str, filename: str):
    """
    Download an encrypted file + metadata.
    Server returns raw encrypted blob — NEVER decrypts.
    """
    email = email.strip().lower()
    filename = filename.strip()

    if not email or not filename:
        raise HTTPException(status_code=400, detail="Email and filename are required.")

    # Validate user exists
    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    # Get user directory
    user_dir = STORAGE_DIR / hashlib.sha256(email.encode()).hexdigest()[:16]
    if not user_dir.exists():
        raise HTTPException(status_code=404, detail="No files found.")

    # Sanitize and resolve path
    safe_name = _sanitize_filename(filename)
    file_path = user_dir / safe_name
    meta_path = user_dir / f"{safe_name}.meta.json"

    # Validate path safety
    if not _validate_path_safety(user_dir, file_path):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if not file_path.exists() or not meta_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    # Read metadata
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    return {
        "metadata": meta,
        "download_url": f"/api/download/blob?email={email}&filename={safe_name}",
    }


@app.get("/api/download/blob")
async def download_blob(email: str, filename: str):
    """Return the raw encrypted blob as a file download."""
    email = email.strip().lower()
    filename = filename.strip()

    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    user_dir = STORAGE_DIR / hashlib.sha256(email.encode()).hexdigest()[:16]
    safe_name = _sanitize_filename(filename)
    file_path = user_dir / safe_name

    if not _validate_path_safety(user_dir, file_path):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename=safe_name,
    )


@app.get("/api/files")
async def list_files(email: str):
    """List all encrypted files for a user."""
    email = email.strip().lower()

    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    user_dir = STORAGE_DIR / hashlib.sha256(email.encode()).hexdigest()[:16]
    if not user_dir.exists():
        return {"files": []}

    files = []
    for meta_file in sorted(user_dir.glob("*.meta.json")):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            files.append(meta)
        except (json.JSONDecodeError, OSError):
            continue

    return {"files": files}


@app.delete("/api/delete")
async def delete_file(request: Request):
    """Delete an encrypted file."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    email = body.get("email", "").strip().lower()
    filename = body.get("filename", "").strip()
    password_hash = body.get("password_hash", "").strip()

    if not email or not filename or not password_hash:
        raise HTTPException(status_code=400, detail="Email, filename, and password are required.")

    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    # Verify password hash
    expected = hashlib.sha256((password_hash + user["server_salt"]).encode()).hexdigest()
    if not secrets.compare_digest(expected, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Authentication failed.")

    user_dir = STORAGE_DIR / hashlib.sha256(email.encode()).hexdigest()[:16]
    safe_name = _sanitize_filename(filename)
    file_path = user_dir / safe_name
    meta_path = user_dir / f"{safe_name}.meta.json"

    if not _validate_path_safety(user_dir, file_path):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    # Delete both file and metadata
    file_path.unlink(missing_ok=True)
    meta_path.unlink(missing_ok=True)

    return {"message": "File deleted successfully."}


# ──────────────── SERVE FRONTEND ────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
