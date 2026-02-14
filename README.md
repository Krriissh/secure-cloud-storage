# SCS — Secure Cloud Storage

**Zero-Knowledge Architecture** • Modern SaaS UI • Hardened Security

> Your files are encrypted in the browser before upload. The server **never** sees your plaintext data or encryption keys.

## 📝 Abstract

This project presents a **Secure Cloud Storage System** based on a **Zero-Knowledge Architecture** using a minimal backend design. The system ensures that all files are encrypted on the client side before being uploaded to the server. The server stores only encrypted data and does not possess the encryption keys required to decrypt user files.

The implementation uses **AES-256-GCM** for authenticated encryption, **PBKDF2** for password-based key derivation, and **SHA-256** for file integrity verification. The backend consists of only three APIs (`/register`, `/upload`, `/download`) and uses file-based storage instead of a database.

The system demonstrates how modern cryptographic techniques can be integrated into a simplified cloud architecture to ensure data confidentiality, integrity, and privacy.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- A modern browser (Chrome, Firefox, Edge)

### Setup

```bash
# Navigate to project
cd scs

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (macOS/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start the server
python -m uvicorn backend.main:app --reload --port 8000
```

Open **http://localhost:8000** in your browser.

---

## 🌩️ Fastest Path to Cloud (10 Minutes)

### Step 1: Push project to GitHub
Ensure your code is in a public or private GitHub repository.

### Step 2: Connect to Render
1.  Go to [render.com](https://render.com).
2.  Select **New Web Service** → Connect your GitHub repo.

### Step 3: Configure
- **Runtime**: `Python`
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port 10000`

### Step 4: Deploy 🎉
Click **Deploy Web Service**. Render will give you a public URL (e.g., `https://scs-secure.onrender.com`).

---

## 📊 Local vs Cloud Comparison

| Feature | Local | Cloud (Render) |
| :--- | :--- | :--- |
| Access from phone | ❌ | ✅ |
| Access anywhere | ❌ | ✅ |
| Demo ready | ⚠ | ✅ |
| Encryption security | ✅ | ✅ |
| Zero-knowledge | ✅ | ✅ |

---

## 🎓 Viva Tips

> “The system is designed for high portability. While it currently uses a minimal file-based backend for project simplicity, it can be deployed on cloud platforms like Render or AWS to provide global access while maintaining strict **Zero-Knowledge Security**.”

### ❓ When to scale to S3 + PostgreSQL?
Integration with enterprise storage (AWS S3) and databases (PostgreSQL) is only necessary if:
- Building a full startup product.
- Scaling to thousands of concurrent users.
- Requirement for long-term multi-region persistence.

*For this implementation, the file-based backend provides the cleanest demonstration of the cryptographic trust boundary.*

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                     BROWSER                         │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  UI / UX  │→ │ Crypto.js    │→ │  API Client │  │
│  │           │  │ PBKDF2       │  │  fetch()    │  │
│  │  app.js   │  │ AES-256-GCM  │  │             │  │
│  │  ui.js    │  │ SHA-256      │  │  api.js     │  │
│  └───────────┘  └──────────────┘  └──────┬──────┘  │
│                                          │         │
│  ════════════ TRUST BOUNDARY ═══════════╪═════════ │
└──────────────────────────────────────────┼─────────┘
                                           │ HTTPS
┌──────────────────────────────────────────┼─────────┐
│                   SERVER                 │         │
│                                          ▼         │
│  ┌──────────────────────────────────────────────┐  │
│  │  FastAPI (main.py)                           │  │
│  │  • Stores encrypted blobs only               │  │
│  │  • Never decrypts anything                   │  │
│  │  • File-based storage (no database)          │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  storage/                                           │
│  ├── users.json          (email + double-hashed pw) │
│  └── <user_hash>/                                   │
│      ├── photo.jpg       (encrypted blob)           │
│      └── photo.jpg.meta.json  (IV, salt, hash)      │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Security Architecture

### Zero-Knowledge Guarantee

| Property | Implementation |
|---|---|
| **Key derivation** | PBKDF2-SHA256, 100,000 iterations |
| **Encryption** | AES-256-GCM (authenticated encryption) |
| **IV** | Random 12-byte IV per file |
| **Integrity** | SHA-256 hash of plaintext, verified on download |
| **Server knowledge** | Encrypted blobs only — no keys, no plaintext |
| **Auth** | Client hashes password before sending; server double-hashes |

### Encryption Flow

**Upload:**
1. User selects file → `FileReader` reads to `ArrayBuffer`
2. PBKDF2 derives AES-256 key from password hash
3. Random IV generated → AES-GCM encrypts file
4. SHA-256 hash computed on plaintext for integrity
5. Encrypted blob + metadata (IV, salt, hash) uploaded

**Download:**
1. Encrypted blob + metadata fetched from server
2. User enters password → PBKDF2 re-derives key
3. AES-GCM decrypts blob (auth tag verified internally)
4. SHA-256 hash recomputed and compared to stored hash
5. If match → file saved. If mismatch → integrity alert.

### Backend Hardening

- **Filename sanitization**: Strips `../`, null bytes, special characters
- **Path traversal prevention**: `Path.resolve()` + parent directory check
- **50 MB file size limit**: Enforced via middleware
- **Timing-safe comparison**: `secrets.compare_digest()` for password checks
- **Duplicate handling**: Auto-appends counter suffix
- **No sensitive logging**: Passwords/keys never logged

---

## 🛡 Threat Model

| Threat | Mitigation |
|---|---|
| **Server compromise** | Attacker gets only encrypted blobs. No keys stored. |
| **Man-in-the-middle** | AES-GCM auth tag detects tampering. Use HTTPS in production. |
| **Brute-force passwords** | PBKDF2 with 100K iterations makes offline attacks expensive. |
| **Path traversal** | Filename sanitized + path validated against user directory. |
| **XSS** | No innerHTML with user data. CSP recommended for production. |
| **Replay attacks** | Each file encrypted with unique IV + salt. |
| **File tampering** | SHA-256 integrity verification on download. |

### What's NOT Protected

- Metadata (file sizes, upload times) is visible to the server
- No protection against a compromised client browser
- No key recovery — if you forget your password, your files are permanently lost
- File names are visible in metadata (use generic names for sensitive files)

---

## 🧪 Testing Notes

| Scenario | Expected Result |
|---|---|
| **Wrong password** | AES-GCM auth tag fails → "Decryption Failed" modal |
| **Corrupted file** | SHA-256 mismatch → "Integrity Check Failed" alert |
| **Large files** | Progress indicators show; 50 MB limit enforced |
| **Path traversal** | `../../etc/passwd` → sanitized to `etcpasswd` |
| **Duplicate filename** | Auto-renamed to `file_1.txt`, `file_2.txt`, etc. |
| **Parallel uploads** | Blocked with "wait for current upload" toast |

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python FastAPI, file-based storage |
| Frontend | Vanilla HTML/CSS/JS |
| Crypto | Web Crypto API (SubtleCrypto) |
| Styling | Custom CSS design system (dark theme) |
| Font | Inter (Google Fonts) |

---

## 🔮 Future Scalability

- **File sharing**: Generate time-limited share links with separate encryption keys
- **Multi-device sync**: Key exchange via QR code or passphrase
- **Client-side search**: Encrypted search index with homomorphic encryption
- **Chunked upload**: Support for files > 50 MB via streaming encryption
- **2FA**: TOTP-based second factor for account protection
- **Database migration**: SQLite or PostgreSQL for user management at scale
- **CDN integration**: Serve encrypted blobs via CDN for global performance
