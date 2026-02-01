import os
import ssl
import smtplib
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from pathlib import Path
from typing import Literal, Optional

AccountType = Literal["admin", "student"]

ENV_LOADED = False


def maybe_load_env_file() -> None:
    """
    Best-effort loader for .env.backend when docker-compose env_file is missing/mispointed.
    Only sets keys that are not already present in os.environ.
    """
    global ENV_LOADED
    if ENV_LOADED:
        return
    ENV_LOADED = True

    explicit = os.getenv("BACKEND_ENV_FILE", "").strip()
    candidates = [
        Path(explicit) if explicit else None,
        Path.cwd() / ".env.backend",
        Path("/app/.env.backend"),
        Path(__file__).resolve().parent / ".env.backend",
    ]
    env_path = next((p for p in candidates if p and p.exists() and p.is_file()), None)
    if not env_path:
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def env_bool(key: str, default: bool = False) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "y", "on")


def send_email(
    to_email: str,
    subject: str,
    text_body: str,
    *,
    from_email: Optional[str] = None,
) -> None:
    """
    SMTP email sender. Configure via env vars:
      SMTP_HOST (required to actually send)
      SMTP_PORT (default 587)
      SMTP_USERNAME
      SMTP_PASSWORD
      SMTP_FROM (default SMTP_USERNAME or "no-reply@abacus.local")
      SMTP_USE_TLS (default true)
      SMTP_USE_SSL (default false)

    If SMTP_HOST is not set, this function prints the email to stdout (dev fallback).
    """
    maybe_load_env_file()

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME", "").strip() or None
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip() or None
    smtp_from = (from_email or os.getenv("SMTP_FROM", "").strip() or smtp_user or "no-reply@abacus.local").strip()

    use_tls = env_bool("SMTP_USE_TLS", True)
    use_ssl = env_bool("SMTP_USE_SSL", False)

    # If you forgot to pass env vars into the container, fail loudly (no silent "sent").
    if not smtp_host:
        raise RuntimeError(
            "SMTP_HOST is not set. Ensure docker-compose env_file points at your .env.backend (or set SMTP_* env vars)."
        )

    # Gmail app passwords are often pasted with spaces; SMTP auth needs the raw token.
    if smtp_pass:
        smtp_pass = smtp_pass.replace(" ", "")

    if use_tls and use_ssl:
        raise RuntimeError("Invalid SMTP config: SMTP_USE_TLS and SMTP_USE_SSL cannot both be true.")

    # Sanitize SMTP_FROM (your .env shows a value with a space, which is not a valid mailbox).
    name, addr = parseaddr(smtp_from)
    if addr and " " in addr and "@" in addr:
        parts = smtp_from.split()
        email_part = next((p for p in reversed(parts) if "@" in p), "")
        display = " ".join([p for p in parts if p != email_part]).strip()
        if email_part:
            smtp_from = formataddr((display, email_part))

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)

    context = ssl.create_default_context()

    if use_ssl:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=context)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port)
        if use_tls:
            server.starttls(context=context)

    try:
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.send_message(msg)
    finally:
        server.quit()


def send_password_link_email(to_email: str, link: str, account_type: AccountType) -> None:
    """
    Sends a password setup/reset link.
    The backend token is signed and expires (default 24 hours).
    """
    if account_type == "admin":
        subject = "Abacus: Reset your teacher password"
        intro = "You requested a teacher password reset for Abacus."
    else:
        subject = "Abacus: Set or reset your student password"
        intro = "Use this link to set or reset your Abacus student password."

    body = (
        f"{intro}\n\n"
        f"Open this link to continue:\n"
        f"{link}\n\n"
        f"If you did not request this, you can ignore this email.\n"
        f"This link expires automatically.\n"
    )

    send_email(to_email=to_email, subject=subject, text_body=body)