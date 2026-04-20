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
export const EMAIL_FROM  = process.env.EMAIL_FROM || `UDBHAV'26 <noreply@udbhav26.in>`;

let _resend = null;
export function getResend() {
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
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 20px !important; }
      .team-code { font-size: 22px !important; letter-spacing: 2px !important; }
    }
  </style>
</head>

<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding: 20px 0;">
<tr>
<td align="center">

<table class="container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">

<!-- Banner -->
<tr>
<td>
<img src="https://img.mailinblue.com/11046946/images/content_library/original/69e4b3cb5e90282e716eb3f9.jpeg" alt="UDBHAV'26" width="600" style="display:block; width:100%; height:auto;">
</td>
</tr>

<!-- Content -->
<tr>
<td class="content-padding" style="padding: 36px 40px;">

<p style="font-size:15px; color:#222; margin-bottom:16px;">
Dear Team <strong>\${teamName}</strong>,
</p>

<p style="font-size:15px; color:#444; line-height:1.6;">
🎉 Your registration has been <strong>successfully completed</strong>, and your <strong>payment has been received successfully</strong>.
</p>

<p style="font-size:15px; color:#444; line-height:1.6; margin-bottom:20px;">
Welcome to <strong>UDBHAV'26</strong>! Your team is now officially confirmed for the hackathon. We’re excited to see what you build 🚀
</p>

<!-- Team Code -->
<table width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px solid #6c63ff; border-bottom: 2px solid #6c63ff; margin-bottom: 24px;">
<tr>
<td align="center" style="padding: 20px 0;">
<p style="margin:0; font-size:13px; font-weight:bold; letter-spacing:2px; color:#6c63ff;">
🔐 YOUR TEAM CODE
</p>

<p class="team-code" style="margin:10px 0; font-size:32px; font-weight:bold; color:#3d35a0; letter-spacing:5px; font-family:monospace;">
\${teamCode}
</p>
</td>
</tr>
</table>

<p style="font-size:14px; color:#222; line-height:1.6;">
⚠️ This Team Code is <strong>confidential</strong>. Do not share it outside your team.
</p>

<p style="font-size:14px; color:#444; margin-bottom:20px;">
Save it safely — you’ll need it during the event.
</p>

<!-- Next Steps -->
<p style="font-size:14px; font-weight:bold; color:#333;">
📋 WHAT’S NEXT
</p>

<ul style="font-size:13px; color:#555; line-height:1.8; padding-left:18px;">
<li>You will be added to the official WhatsApp group soon</li>
<li>Further instructions will be shared there</li>
<li>Keep your Team Code ready for all event activities</li>
</ul>

<p style="font-size:14px; color:#444;">
We look forward to seeing you at the event!
</p>

<!-- Contact Section -->
<div style="margin-top:25px; padding:15px; background:#f9f9ff; border:1px solid #e0dcff; border-radius:8px;">
<p style="margin:0 0 8px 0; font-size:14px; font-weight:bold; color:#333;">
📞 Need Help?
</p>

<p style="margin:0; font-size:13px; color:#555; line-height:1.6;">
Rishabh Vyas — +91 9575625112<br>
Prince Yadav — +91 8591442334
</p>
</div>

<p style="margin-top:20px; font-size:15px; color:#222;">
Warm regards,<br>
<strong style="color:#6c63ff;">Team UDBHAV'26</strong><br>
<span style="font-size:13px; color:#888;">Sage University, Indore</span>
</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="background:#f0edff; padding:16px; text-align:center;">
<p style="font-size:11px; color:#888;">© 2026 UDBHAV'26</p>
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
      subject: `Your team ${teamName} has succesfully registered for udbhav26`,
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
      } catch (_) { /* silent */ }
      
      return false;
    }
  }
}
