import nodemailer from "nodemailer";

const MODE = process.env.EMAIL_MODE || "console";

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: process.env.EMAIL_USER
      ? { user: process.env.EMAIL_USER, password: process.env.EMAIL_PASSWORD }
      : undefined,
  });
  return transporter;
}

/**
 * Sends a single participant their own private delivery link.
 * Never call this with both participants' data at once — each person only
 * ever sees their own email/link, never their partner's.
 */
export async function sendDeliveryEmail({ to, username, downloadUrl, expiresInMinutes = 60 }) {
  const subject = "Your LDRBOOTH memory is ready ❤️";
  const text =
    `Hi ${username},\n\n` +
    `Your shared LDRBOOTH memory is ready.\n` +
    `This link is valid for ${expiresInMinutes} minutes:\n\n` +
    `${downloadUrl}\n\n` +
    `— LDRBOOTH`;
  const html = `
    <div style="font-family:sans-serif;color:#3A2E2A;max-width:480px;margin:0 auto;">
      <h2 style="color:#C85C74;">Your LDRBOOTH memory is ready ❤️</h2>
      <p>Hi ${escapeHtml(username)},</p>
      <p>Your shared LDRBOOTH memory is ready. This link is valid for ${expiresInMinutes} minutes.</p>
      <p><a href="${downloadUrl}" style="display:inline-block;padding:12px 20px;background:#C85C74;color:#fff;border-radius:999px;text-decoration:none;">View your photos</a></p>
      <p style="font-size:13px;color:#8a7a72;">If the button doesn't work, copy this link:<br/>${downloadUrl}</p>
    </div>`;

  if (MODE === "console") {
    console.log("──────── [email:console] ────────");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Link:    ${downloadUrl}`);
    console.log(`Expires: ${expiresInMinutes} min`);
    console.log("──────────────────────────────────");
    return { status: "sent", mode: "console" };
  }

  if (MODE === "smtp") {
    try {
      await getTransporter().sendMail({
        from: process.env.EMAIL_FROM || "LDRBOOTH <hello@ldrbooth.app>",
        to,
        subject,
        text,
        html,
      });
      return { status: "sent", mode: "smtp" };
    } catch (err) {
      console.error("[email:smtp] send failed:", err.message);
      return { status: "failed", mode: "smtp", error: err.message };
    }
  }

  console.warn(`[email] Unknown EMAIL_MODE "${MODE}" — falling back to console.`);
  console.log(`Would send to ${to}: ${downloadUrl}`);
  return { status: "sent", mode: "console-fallback" };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
