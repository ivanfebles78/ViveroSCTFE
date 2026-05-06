"""
Servicio de email para ViverApp.

Drivers soportados:
  - "console" (default): imprime el email en stdout. Útil para desarrollo y para
    el primer despliegue antes de configurar un proveedor real.
  - "resend": envía a través de la API HTTPS de Resend (https://resend.com).
    Configurar con EMAIL_DRIVER=resend, RESEND_API_KEY=..., EMAIL_FROM=...

Plantillas:
  - send_invitation_email: cuando el admin crea una cuenta.
  - send_reset_password_email: cuando el admin pulsa Reset password.
  - send_unlock_email: cuando el admin desbloquea una cuenta.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Optional, Tuple


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _frontend_url() -> str:
    return _env("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _email_from() -> str:
    return _env("EMAIL_FROM", "ViverApp <onboarding@resend.dev>")


def _parse_email_from() -> Tuple[str, str]:
    """
    Convierte 'ViverApp <noreply@dominio.com>' en ('ViverApp', 'noreply@dominio.com').
    Si solo viene el email crudo, devuelve nombre = 'ViverApp' por defecto.
    """
    raw = _email_from()
    m = re.match(r"^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$", raw)
    if m:
        return m.group(1).strip().strip('"'), m.group(2).strip()
    # Solo email
    if "@" in raw:
        return "ViverApp", raw.strip()
    # Fallback
    return "ViverApp", "noreply@example.com"


def _driver() -> str:
    return _env("EMAIL_DRIVER", "console").lower()


# ----------------------------------------------------------------------------
# Drivers
# ----------------------------------------------------------------------------

def _send_console(*, to: str, subject: str, html: str, text: str) -> None:
    print("=" * 72)
    print(f"[email:console] To:      {to}")
    print(f"[email:console] From:    {_email_from()}")
    print(f"[email:console] Subject: {subject}")
    print("-" * 72)
    print(text)
    print("=" * 72, flush=True)


def _send_resend(*, to: str, subject: str, html: str, text: str) -> None:
    api_key = _env("RESEND_API_KEY")
    if not api_key:
        # Sin API key, caemos a consola para no perder el mensaje
        print(
            "[email:resend] WARNING: RESEND_API_KEY no configurada. "
            "Cayendo a driver consola."
        )
        _send_console(to=to, subject=subject, html=html, text=text)
        return

    payload = {
        "from": _email_from(),
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url="https://api.resend.com/emails",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            # User-Agent explícito: el default de urllib lo bloquea Cloudflare (error 1010).
            "User-Agent": "ViverApp/1.0 (+https://github.com/) python-urllib",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status >= 400:
                body = resp.read().decode("utf-8", errors="replace")
                print(f"[email:resend] HTTP {resp.status}: {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"[email:resend] ERROR HTTP {e.code}: {body}")
        # No relanzamos: el flujo de admin no debería romperse porque falle el email.
        # El admin puede usar "Reenviar invitación" si hace falta.
    except Exception as e:  # noqa: BLE001
        print(f"[email:resend] ERROR: {e}")


def _send_brevo(*, to: str, subject: str, html: str, text: str) -> None:
    api_key = _env("BREVO_API_KEY")
    if not api_key:
        print(
            "[email:brevo] WARNING: BREVO_API_KEY no configurada. "
            "Cayendo a driver consola."
        )
        _send_console(to=to, subject=subject, html=html, text=text)
        return

    sender_name, sender_email = _parse_email_from()

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url="https://api.brevo.com/v3/smtp/email",
        data=data,
        method="POST",
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            # User-Agent explícito por si Cloudflare bloquea el default de urllib.
            "User-Agent": "ViverApp/1.0 (+https://github.com/) python-urllib",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status >= 400:
                body = resp.read().decode("utf-8", errors="replace")
                print(f"[email:brevo] HTTP {resp.status}: {body}")
            else:
                # Brevo responde 201 con un messageId al aceptar el envío.
                body = resp.read().decode("utf-8", errors="replace")
                print(f"[email:brevo] OK {resp.status}: {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"[email:brevo] ERROR HTTP {e.code}: {body}")
    except Exception as e:  # noqa: BLE001
        print(f"[email:brevo] ERROR: {e}")


def _dispatch(*, to: str, subject: str, html: str, text: str) -> None:
    driver = _driver()
    if driver == "resend":
        _send_resend(to=to, subject=subject, html=html, text=text)
    elif driver == "brevo":
        _send_brevo(to=to, subject=subject, html=html, text=text)
    else:
        _send_console(to=to, subject=subject, html=html, text=text)


# ----------------------------------------------------------------------------
# Plantillas
# ----------------------------------------------------------------------------

def _wrap_html(title: str, body_html: str, button_label: str, button_url: str, footer: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#10231a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0f5132;padding:24px 32px;">
          <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            ViverApp
          </div>
          <div style="color:#dcfce7;font-size:12px;margin-top:4px;">
            Ayuntamiento de Santa Cruz de Tenerife
          </div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:#10231a;font-size:22px;">{title}</h1>
          <div style="font-size:15px;line-height:1.55;color:#3f4c46;">
            {body_html}
          </div>
          <div style="margin:32px 0;text-align:center;">
            <a href="{button_url}"
               style="display:inline-block;padding:14px 28px;background:#0f5132;color:#ffffff;
                      text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
              {button_label}
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
            Si el botón no funciona, copia este enlace en tu navegador:<br>
            <span style="word-break:break-all;color:#0f5132;">{button_url}</span>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#64748b;">
            Este enlace caduca en <strong>24 horas</strong> y solo puede usarse una vez.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid rgba(15,23,42,0.06);
                       font-size:12px;color:#64748b;">
          {footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _wrap_text(intro: str, button_url: str, outro: str) -> str:
    return (
        f"{intro}\n\n"
        f"{button_url}\n\n"
        f"{outro}\n\n"
        "Este enlace caduca en 24 horas y solo puede usarse una vez.\n"
        "— ViverApp · Ayuntamiento de Santa Cruz de Tenerife\n"
    )


def send_invitation_email(*, to: str, username: str, token: str) -> None:
    url = f"{_frontend_url()}/activar/{token}"
    subject = "Has sido invitado a ViverApp"
    html = _wrap_html(
        title="Bienvenido/a a ViverApp",
        body_html=(
            f"Hola <strong>{username}</strong>,<br><br>"
            "Se ha creado una cuenta para ti en ViverApp, el sistema de gestión "
            "del vivero municipal de Santa Cruz de Tenerife.<br><br>"
            "Para activar tu cuenta y definir tu contraseña, pulsa el botón inferior."
        ),
        button_label="Activar cuenta",
        button_url=url,
        footer="Si no esperabas este email, puedes ignorarlo: la cuenta solo se activa al usar el enlace.",
    )
    text = _wrap_text(
        intro=(
            f"Hola {username},\n\n"
            "Se ha creado una cuenta para ti en ViverApp.\n"
            "Para activar tu cuenta y definir tu contraseña, abre este enlace:"
        ),
        button_url=url,
        outro="Si no esperabas este email, puedes ignorarlo.",
    )
    _dispatch(to=to, subject=subject, html=html, text=text)


def send_reset_password_email(*, to: str, username: str, token: str) -> None:
    url = f"{_frontend_url()}/reset-password/{token}"
    subject = "Reset Password"
    html = _wrap_html(
        title="Restablece tu contraseña",
        body_html=(
            f"Hola <strong>{username}</strong>,<br><br>"
            "Un administrador ha solicitado el restablecimiento de tu contraseña en ViverApp.<br>"
            "Pulsa el botón inferior para definir una nueva."
        ),
        button_label="Restablecer contraseña",
        button_url=url,
        footer="Si no has pedido este cambio, contacta inmediatamente con el administrador.",
    )
    text = _wrap_text(
        intro=(
            f"Hola {username},\n\n"
            "Un administrador ha solicitado el restablecimiento de tu contraseña.\n"
            "Para definir una nueva contraseña, abre este enlace:"
        ),
        button_url=url,
        outro="Si no has pedido este cambio, contacta inmediatamente con el administrador.",
    )
    _dispatch(to=to, subject=subject, html=html, text=text)


def send_unlock_email(*, to: str, username: str, token: str) -> None:
    url = f"{_frontend_url()}/desbloquear/{token}"
    subject = "Desbloqueo de cuenta"
    html = _wrap_html(
        title="Tu cuenta ha sido desbloqueada",
        body_html=(
            f"Hola <strong>{username}</strong>,<br><br>"
            "Un administrador ha desbloqueado tu cuenta en ViverApp tras el bloqueo "
            "por intentos fallidos. Para reactivarla, define una nueva contraseña."
        ),
        button_label="Definir nueva contraseña",
        button_url=url,
        footer="Si no has solicitado este desbloqueo, contacta con el administrador.",
    )
    text = _wrap_text(
        intro=(
            f"Hola {username},\n\n"
            "Un administrador ha desbloqueado tu cuenta en ViverApp.\n"
            "Para reactivarla, define una nueva contraseña en este enlace:"
        ),
        button_url=url,
        outro="Si no has solicitado este desbloqueo, contacta con el administrador.",
    )
    _dispatch(to=to, subject=subject, html=html, text=text)
