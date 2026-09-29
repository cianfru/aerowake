"""
Password hashing utilities using bcrypt directly.

Note: passlib[bcrypt] is incompatible with bcrypt >= 4.1 due to
the removal of bcrypt.__about__. We use bcrypt directly instead.
"""

import bcrypt
import hashlib
import base64


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    digest = base64.b64encode(hashlib.sha256(plain.encode("utf-8")).digest())
    return "sha256$" + bcrypt.hashpw(digest, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    raw = plain.encode("utf-8")
    if hashed.startswith("sha256$"):
        raw = base64.b64encode(hashlib.sha256(raw).digest())
        hashed = hashed.removeprefix("sha256$")
    elif len(raw) > 72:
        return False
    try:
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
    except ValueError:
        return False
