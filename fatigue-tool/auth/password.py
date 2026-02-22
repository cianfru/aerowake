"""
Password hashing utilities using bcrypt directly.

Note: passlib[bcrypt] is incompatible with bcrypt >= 4.1 due to
the removal of bcrypt.__about__. We use bcrypt directly instead.
"""

import bcrypt


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
