import os
import smtplib
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, List, Dict, Any

logger = logging.getLogger("zeroclash.notifications")

class NotificationProvider(ABC):
    """Abstract interface for sending notifications."""
    @abstractmethod
    def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> bool:
        pass


class SMTPNotificationProvider(NotificationProvider):
    """Production/Staging SMTP email provider configured via environment variables."""
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        from_email: Optional[str] = None,
        use_tls: Optional[bool] = None,
    ):
        self.host = host or os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.port = int(port or os.getenv("SMTP_PORT", "587"))
        self.user = user or os.getenv("SMTP_USER", "")
        self.password = password or os.getenv("SMTP_PASSWORD", "")
        self.from_email = from_email or os.getenv("SMTP_FROM", "noreply@zeroclash.campus.edu")
        self.use_tls = use_tls if use_tls is not None else os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")

    def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> bool:
        if not self.host or not self.user:
            logger.warning("[SMTP] Missing SMTP credentials, skipping delivery.")
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to_email

        msg.attach(MIMEText(body_text, "plain"))
        if body_html:
            msg.attach(MIMEText(body_html, "html"))

        try:
            logger.info(f"[SMTP] Connecting to {self.host}:{self.port} to send '{subject}' to {to_email}")
            with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                if self.use_tls:
                    server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.sendmail(self.from_email, [to_email], msg.as_string())
            logger.info(f"[SMTP] Successfully sent '{subject}' to {to_email}")
            return True
        except Exception as e:
            logger.error(f"[SMTP] Failed to send email to {to_email}: {e}")
            return False


class ConsoleNotificationProvider(NotificationProvider):
    """Dev and test fallback provider that logs formatted emails and keeps an in-memory history."""
    def __init__(self):
        self.sent_messages: List[Dict[str, Any]] = []

    def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> bool:
        record = {
            "to_email": to_email,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "timestamp": datetime.now(),
        }
        self.sent_messages.append(record)

        print(
            "\n" + "=" * 70 + "\n"
            f"[EMAIL ALERT - CONSOLE FALLBACK]\n"
            f"To:      {to_email}\n"
            f"Subject: {subject}\n"
            + "-" * 70 + "\n"
            f"{body_text}\n"
            + "=" * 70 + "\n"
        )
        return True


class NotificationService:
    """High-level email alerts service for ZeroClash engine events."""
    def __init__(self, provider: Optional[NotificationProvider] = None):
        if provider:
            self.provider = provider
        else:
            smtp_host = os.getenv("SMTP_HOST")
            smtp_user = os.getenv("SMTP_USER")
            if smtp_host and smtp_user:
                self.provider = SMTPNotificationProvider()
            else:
                self.provider = ConsoleNotificationProvider()

    def send_booking_confirmed(
        self,
        user_email: str,
        user_name: str,
        booking_id: str,
        unit_name: str,
        unit_number: str,
        start_time: datetime,
        end_time: datetime,
        purpose: str,
        qr_token: Optional[str] = None
    ) -> bool:
        subject = f"[ZeroClash] Booking Confirmed: {unit_name} ({unit_number})"
        time_str = f"{start_time.strftime('%Y-%m-%d %H:%M UTC')} to {end_time.strftime('%H:%M UTC')}"
        body_text = (
            f"Hello {user_name},\n\n"
            f"Your reservation for {unit_name} ({unit_number}) is confirmed!\n\n"
            f"Booking ID: {booking_id}\n"
            f"Scheduled Window: {time_str}\n"
            f"Purpose: {purpose}\n"
            f"QR Security Token: {qr_token or 'Generated on demand'}\n\n"
            f"IMPORTANT: Please check in using your digital pass between 10 minutes before your start time "
            f"and 15 minutes after. Unclaimed slots will be automatically released to waitlisted students.\n\n"
            f"Best regards,\n"
            f"ZeroClash Campus Hub"
        )
        body_html = f"""
        <div style="font-family: sans-serif; background: #0b1320; color: #f1f5f9; padding: 20px; border-radius: 8px;">
          <h2 style="color: #38bdf8; margin-top: 0;">Reservation Confirmed</h2>
          <p>Hello <strong>{user_name}</strong>,</p>
          <p>Your equipment booking has been successfully locked into schedule:</p>
          <ul>
            <li><strong>Equipment:</strong> {unit_name} ({unit_number})</li>
            <li><strong>Booking ID:</strong> {booking_id}</li>
            <li><strong>Time Window:</strong> {time_str}</li>
            <li><strong>Purpose:</strong> {purpose}</li>
          </ul>
          <p style="color: #fbbf24; font-size: 13px;">
            ⚠️ <em>Check-in window opens 10m before start and closes 15m after start. Please arrive on time.</em>
          </p>
        </div>
        """
        return self.provider.send_email(user_email, subject, body_text, body_html)

    def send_booking_cancelled(
        self,
        user_email: str,
        user_name: str,
        booking_id: str,
        unit_name: str,
        unit_number: str,
        start_time: datetime,
        end_time: datetime,
        reason: Optional[str] = None
    ) -> bool:
        subject = f"[ZeroClash] Booking Cancelled: {unit_name} ({unit_number})"
        time_str = f"{start_time.strftime('%Y-%m-%d %H:%M UTC')} to {end_time.strftime('%H:%M UTC')}"
        body_text = (
            f"Hello {user_name},\n\n"
            f"Your reservation for {unit_name} ({unit_number}) on {time_str} has been cancelled.\n"
            f"Reason: {reason or 'Requested by user or automated policy'}\n\n"
            f"This slot has been released back into campus circulation.\n\n"
            f"Best regards,\n"
            f"ZeroClash Campus Hub"
        )
        return self.provider.send_email(user_email, subject, body_text)

    def send_hold_awarded(
        self,
        user_email: str,
        user_name: str,
        hold_id: str,
        unit_name: str,
        unit_number: str,
        start_time: datetime,
        end_time: datetime,
        expires_at: datetime,
        confirm_url: Optional[str] = None
    ) -> bool:
        subject = f"[ZeroClash] Action Required: 10-Minute Hold Awarded for {unit_name}"
        time_str = f"{start_time.strftime('%Y-%m-%d %H:%M UTC')} to {end_time.strftime('%H:%M UTC')}"
        deadline_str = expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')
        url = confirm_url or f"http://localhost:5173/holds/{hold_id}/confirm"

        body_text = (
            f"Hello {user_name},\n\n"
            f"Great news! A previously booked slot for {unit_name} ({unit_number}) just opened up, "
            f"and you have been awarded top priority hold!\n\n"
            f"Slot Window: {time_str}\n"
            f"Confirmation Deadline: {deadline_str} (STRICT 10-MINUTE WINDOW)\n\n"
            f"To claim this slot, confirm immediately via the link below:\n"
            f"{url}\n\n"
            f"If unconfirmed before {deadline_str}, the hold will expire and cascade to the next student.\n\n"
            f"Best regards,\n"
            f"ZeroClash Priority Waitlist Engine"
        )
        body_html = f"""
        <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #38bdf8;">
          <h2 style="color: #38bdf8; margin-top: 0;">⚡ 10-Minute Provisional Hold Awarded</h2>
          <p>Hello <strong>{user_name}</strong>,</p>
          <p>A slot has opened for <strong>{unit_name} ({unit_number})</strong> and you are next in line!</p>
          <p><strong>Slot Time:</strong> {time_str}<br/>
             <strong>Deadline:</strong> <span style="color: #f59e0b; font-weight: bold;">{deadline_str}</span> (10 minutes)
          </p>
          <div style="margin: 20px 0;">
            <a href="{url}" style="background: #0ea5e9; color: #020617; font-weight: bold; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
              Confirm & Lock Reservation
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">If you do not confirm within 10 minutes, the hold expires and cascades.</p>
        </div>
        """
        return self.provider.send_email(user_email, subject, body_text, body_html)

    def send_hold_expired(
        self,
        user_email: str,
        user_name: str,
        hold_id: str,
        unit_name: str,
        unit_number: str
    ) -> bool:
        subject = f"[ZeroClash] Hold Expired: {unit_name} ({unit_number})"
        body_text = (
            f"Hello {user_name},\n\n"
            f"Your 10-minute provisional hold (Hold ID: {hold_id}) for {unit_name} ({unit_number}) "
            f"has expired without confirmation.\n\n"
            f"The slot has cascaded to the next eligible waitlisted researcher or student.\n\n"
            f"Best regards,\n"
            f"ZeroClash Campus Hub"
        )
        return self.provider.send_email(user_email, subject, body_text)

    def send_maintenance_cancellation(
        self,
        user_email: str,
        user_name: str,
        booking_id: str,
        unit_name: str,
        unit_number: str,
        start_time: datetime,
        end_time: datetime,
        maint_reason: str
    ) -> bool:
        subject = f"[ZeroClash] Notice: Reservation Cancelled Due to Urgent Maintenance"
        time_str = f"{start_time.strftime('%Y-%m-%d %H:%M UTC')} to {end_time.strftime('%H:%M UTC')}"
        body_text = (
            f"Hello {user_name},\n\n"
            f"We regret to inform you that your upcoming booking for {unit_name} ({unit_number}) on {time_str} "
            f"has been cancelled due to required hardware maintenance.\n\n"
            f"Maintenance Reason: {maint_reason}\n"
            f"Booking ID: {booking_id}\n\n"
            f"Please visit the ZeroClash Digital Twin to explore alternative units or reschedule.\n\n"
            f"Best regards,\n"
            f"Lab Administration Team"
        )
        return self.provider.send_email(user_email, subject, body_text)

    def send_reminder_30m(
        self,
        user_email: str,
        user_name: str,
        booking_id: str,
        unit_name: str,
        unit_number: str,
        start_time: datetime,
        end_time: datetime
    ) -> bool:
        subject = f"[ZeroClash] Reminder: Your reservation begins in 30 minutes ({unit_name})"
        time_str = f"{start_time.strftime('%H:%M UTC')} - {end_time.strftime('%H:%M UTC')}"
        body_text = (
            f"Hello {user_name},\n\n"
            f"This is a reminder that your reservation for {unit_name} ({unit_number}) starts in 30 minutes!\n\n"
            f"Scheduled Time: {time_str} today\n"
            f"Booking ID: {booking_id}\n\n"
            f"REMINDER: Check-in opens 10 minutes before your slot and closes 15 minutes after start. "
            f"Have your digital QR pass ready at the lab door scanner.\n\n"
            f"Best regards,\n"
            f"ZeroClash Campus Hub"
        )
        return self.provider.send_email(user_email, subject, body_text)


# Global singleton instance
notification_service = NotificationService()

def get_notification_service() -> NotificationService:
    return notification_service

def set_notification_service(service: NotificationService) -> None:
    global notification_service
    notification_service = service
