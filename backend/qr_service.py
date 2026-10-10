import hmac
import hashlib
import os
import io
import base64
from datetime import datetime, timezone
from typing import Tuple, Optional
import qrcode

QR_SECRET = os.getenv("QR_HMAC_SECRET", "zeroclash-campus-secret-key-2026")

def generate_signed_token(booking_id: str, expiry_timestamp: int) -> str:
    """
    Creates an HMAC-SHA256 signed token for a booking.
    Format: <booking_id>:<expiry_timestamp>:<signature>
    """
    payload = f"{booking_id}:{expiry_timestamp}"
    signature = hmac.new(QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}:{signature}"

def verify_signed_token(token: str, current_time: Optional[datetime] = None) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verifies token structure, signature, and timestamp validity.
    Returns: (is_valid, booking_id, error_reason)
    """
    if not token or ":" not in token:
        return False, None, "Malformed QR token structure"
    
    parts = token.split(":")
    if len(parts) != 3:
        return False, None, "Invalid token format, expected booking_id:expiry:sig"
    
    booking_id, expiry_str, signature = parts
    try:
        expiry_ts = int(expiry_str)
    except ValueError:
        return False, None, "Invalid expiry format"

    # Verify signature
    payload = f"{booking_id}:{expiry_ts}"
    expected_sig = hmac.new(QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(signature, expected_sig):
        return False, None, "Invalid or forged QR token signature"

    # Verify expiration
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    current_ts = int(current_time.timestamp())
    
    if current_ts > expiry_ts:
        return False, booking_id, "QR token expired"

    return True, booking_id, None

def generate_qr_data_url(data: str) -> str:
    """
    Generates a base64 encoded PNG data URI from string data.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"
