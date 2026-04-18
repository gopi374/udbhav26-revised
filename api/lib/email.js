/**
 * api/lib/email.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Email service using Resend SDK.
 * Sends the team code confirmation email after successful payment.
 *
 * Required env var: RESEND_API_KEY
 */

import { Resend } from 'resend';

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'admin@udbhav26.in';
// EMAIL_FROM: set to your verified Resend sender.
// For testing: EMAIL_FROM=onboarding@resend.dev
// For production (after domain verification): EMAIL_FROM=noreply@udbhav26.in
const EMAIL_FROM  = process.env.EMAIL_FROM || `UDBHAV'26 <noreply@udbhav26.in>`;

let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  _resend = new Resend(key);
  return _resend;
}

/**
 * Builds the HTML email for team registration confirmation.
 */
function buildEmailHtml({ teamName, teamCode, wantsMentor, amountPaid }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're registered for UDBHAV'26!</title>
</head>
<body style="margin:0;padding:0;background:#09090f;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#0f0f1a;border-radius:16px;border:1px solid rgba(168,85,247,0.2);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e0a3c 0%,#0f0f1a 100%);padding:32px 40px;border-bottom:1px solid rgba(168,85,247,0.15);">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(168,85,247,0.7);font-family:monospace;">UDBHAV'26 · ALTA SCHOOL OF TECHNOLOGY</p>
              <h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:-0.03em;color:#fff;">Registration Confirmed</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.65);">
                Congratulations! Your team <strong style="color:#fff;">${teamName}</strong> is officially registered for <strong style="color:#a855f7;">UDBHAV'26</strong>.
              </p>

              <!-- Team Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:24px;text-align:center;">
                    <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(168,85,247,0.6);font-family:monospace;">Your Team Code</p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.18em;color:#a855f7;font-family:'Courier New',Courier,monospace;">${teamCode}</p>
                    <p style="margin:10px 0 0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.5;">🔑 This is your key for the PS Drop on<br><strong style="color:rgba(255,255,255,0.5);">25 April 2026 at 10:45 AM IST</strong><br>Keep it safe. Do not share.</p>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.35);font-family:monospace;letter-spacing:0.08em;">AMOUNT PAID</span>
                    <span style="float:right;font-size:14px;font-weight:600;color:#fff;">₹${amountPaid}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.35);font-family:monospace;letter-spacing:0.08em;">MENTOR SESSION</span>
                    <span style="float:right;font-size:14px;font-weight:600;color:${wantsMentor ? '#a855f7' : 'rgba(255,255,255,0.4)'};">${wantsMentor ? 'Included ✓' : 'Not selected'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-size:12px;color:rgba(255,255,255,0.35);font-family:monospace;letter-spacing:0.08em;">EVENT DATE</span>
                    <span style="float:right;font-size:14px;font-weight:600;color:#fff;">25–26 April 2026</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.35);font-family:monospace;letter-spacing:0.08em;">VENUE</span>
                    <span style="float:right;font-size:14px;font-weight:600;color:#fff;">Sage University, Indore</span>
                  </td>
                </tr>
              </table>

              <!-- What to bring -->
              <div style="margin-top:28px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:20px;">
                <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.3);">What to Bring</p>
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.8;">
                  💻 Laptop &amp; charger &nbsp;·&nbsp; 🪪 ID proof &nbsp;·&nbsp; 🍽️ Enthusiasm
                </p>
              </div>

              <!-- PS Drop reminder -->
              <div style="margin-top:20px;background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:20px;">
                <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(168,85,247,0.5);">⏳ PS Drop Reminder</p>
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.7;">
                  Be online at <strong style="color:rgba(255,255,255,0.8);">10:45 AM IST on 25 April 2026</strong> to choose your Problem Statement. You'll need your Team Code: <strong style="color:#a855f7;font-family:monospace;">${teamCode}</strong>
                </p>
              </div>

              <!-- Contact -->
              <div style="margin-top:28px;">
                <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Need Help?</p>
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.8;">
                  Rishabh: <a href="tel:+919575625112" style="color:#a855f7;text-decoration:none;">+91 9575625112</a><br>
                  Prince: <a href="tel:+918591442334" style="color:#a855f7;text-decoration:none;">+91 8591442334</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;color:rgba(255,255,255,0.2);">
                <a href="https://udbhav26.in" style="color:#a855f7;text-decoration:none;">udbhav26.in</a>
              </p>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.15);">© 2026 Alta School of Technology. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends the team code confirmation email.
 * Retries once on failure. Logs error and returns false if both fail.
 *
 * @param {Object} opts
 * @param {string} opts.to          - Leader email address
 * @param {string} opts.teamName
 * @param {string} opts.teamCode
 * @param {boolean} opts.wantsMentor
 * @param {number} opts.amountPaid  - Amount in ₹ (not paise)
 * @returns {Promise<boolean>}
 */
export async function sendTeamCodeEmail({ to, teamName, teamCode, wantsMentor, amountPaid }) {
  const html = buildEmailHtml({ teamName, teamCode, wantsMentor, amountPaid });

  async function attempt() {
    const resend = getResend();
    return resend.emails.send({
      from:    EMAIL_FROM,
      to:      [to],
      subject: `🎉 Your Team Code for UDBHAV'26 — ${teamCode}`,
      html,
    });
  }

  try {
    const { error } = await attempt();
    if (error) throw new Error(error.message);
    console.log(`[email] ✅ Team code email sent to ${to} (${teamCode})`);
    return true;
  } catch (err) {
    console.error(`[email] ❌ First attempt failed for ${to}:`, err.message);
    // Retry once after 3 seconds
    try {
      await new Promise(r => setTimeout(r, 3000));
      const { error } = await attempt();
      if (error) throw new Error(error.message);
      console.log(`[email] ✅ Team code email sent (retry) to ${to}`);
      return true;
    } catch (err2) {
      console.error(`[email] ❌ Retry also failed for ${to}:`, err2.message);
      // Alert admin
      try {
        const resend = getResend();
        await resend.emails.send({
          from:    EMAIL_FROM,
          to:      [ADMIN_EMAIL],
          subject: `🚨 EMAIL DELIVERY FAILED — Team: ${teamName}`,
          html:    `<p>Failed to deliver team code email to <strong>${to}</strong>.<br>Team: ${teamName}<br>Code: <strong>${teamCode}</strong><br>Error: ${err2.message}</p>`,
        });
      } catch (_) { /* silent — admin alert failure is non-critical */ }
      return false;
    }
  }
}
