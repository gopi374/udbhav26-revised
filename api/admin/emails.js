import { connectDB } from '../lib/mongodb.js';
import { Team } from '../models/Team.js';
import { Registration } from '../models/Registration.js';
import { getResend, EMAIL_FROM } from '../lib/email.js';

// Helper to check admin API key
function authGuard(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

// ── GET /api/admin/emails/pending
export async function getPendingEmailsHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    const target = req.query.target || 'paid';
    await connectDB();
    
    let query = {};
    if (target === 'paid') {
      query = {
        paymentStatus: 'paid',
        codeGenerated: true,
        confirmationEmailSent: { $ne: true }
      };
    } else if (target === 'pending') {
      query = {
        paymentStatus: 'pending',
        paymentReminderSent: { $ne: true }
      };
    } else {
      return res.status(400).json({ success: false, error: 'Invalid target type' });
    }

    const teams = await Team.find(query).select('teamName code leader.name leader.email collegeName paymentStatus').lean();

    return res.status(200).json({ success: true, count: teams.length, teams });
  } catch (err) {
    console.error('[admin/emails] get pending error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /api/admin/emails/send-bulk
export async function sendBulkEmailsHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const { subject, htmlTemplate, target, testEmail } = req.body;
    
    if (!subject || !htmlTemplate) {
      return res.status(400).json({ success: false, error: 'Subject and HTML Template are required.' });
    }

    const resend = getResend();

    // ── TEST MODE ──
    if (target === 'test') {
      if (!testEmail) return res.status(400).json({ success: false, error: 'testEmail is required for test mode' });
      
      const personalizedHtml = htmlTemplate
        .replace(/\{\{TEAM_NAME\}\}/g, 'Super Coders (TEST)')
        .replace(/\{\{TEAM_CODE\}\}/g, 'TS-XYZ-999');

      const personalizedSubject = `[TEST] ` + subject
        .replace(/\{\{TEAM_NAME\}\}/g, 'Super Coders (TEST)')
        .replace(/\{\{TEAM_CODE\}\}/g, 'TS-XYZ-999');

      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [testEmail],
        subject: personalizedSubject,
        html: personalizedHtml
      });

      if (error) throw new Error(error.message);

      return res.status(200).json({ success: true, message: 'Test email sent successfully.', sent: 1 });
    }

    // ── PRODUCTION SEND ──
    let query = {};
    if (target === 'paid') {
      query = {
        paymentStatus: 'paid',
        codeGenerated: true,
        confirmationEmailSent: { $ne: true }
      };
    } else if (target === 'pending') {
      query = {
        paymentStatus: 'pending',
        paymentReminderSent: { $ne: true }
      };
    } else {
      return res.status(400).json({ success: false, error: 'Invalid target type' });
    }

    const pendingTeams = await Team.find(query);

    if (pendingTeams.length === 0) {
      return res.status(400).json({ success: false, error: 'No teams found for this query.' });
    }

    const batchPayloads = [];
    const updatedIds = [];

    for (const team of pendingTeams) {
      // Pending teams might not have a code. Graceful fallback.
      const safeCode = team.code || '[Issued after Payment]';

      const personalizedHtml = htmlTemplate
        .replace(/\{\{TEAM_NAME\}\}/g, team.teamName)
        .replace(/\{\{TEAM_CODE\}\}/g, safeCode);
        
      const personalizedSubject = subject
        .replace(/\{\{TEAM_NAME\}\}/g, team.teamName)
        .replace(/\{\{TEAM_CODE\}\}/g, safeCode);

      batchPayloads.push({
        from: EMAIL_FROM,
        to: [team.leader.email],
        subject: personalizedSubject,
        html: personalizedHtml
      });
      updatedIds.push(team._id);
    }

    // Process batches of 100 per Resend API limits
    const chunkSize = 100;
    let successCount = 0;

    for (let i = 0; i < batchPayloads.length; i += chunkSize) {
      const chunk = batchPayloads.slice(i, i + chunkSize);
      const { error } = await resend.batch.send(chunk);
      if (error) {
        throw new Error(error.message);
      }
      successCount += chunk.length;
    }

    // Now update DB flags based on target
    if (target === 'paid') {
      await Team.updateMany({ _id: { $in: updatedIds } }, { $set: { confirmationEmailSent: true } });
      const codes = pendingTeams.filter(t => updatedIds.includes(t._id)).map(t => t.code);
      await Registration.updateMany({ teamCode: { $in: codes } }, { $set: { confirmationEmailSent: true } });
    } else if (target === 'pending') {
      await Team.updateMany({ _id: { $in: updatedIds } }, { $set: { paymentReminderSent: true } });
      const leaderEmails = pendingTeams.filter(t => updatedIds.includes(t._id)).map(t => t.leader.email);
      await Registration.updateMany({ 'leader.email': { $in: leaderEmails } }, { $set: { paymentReminderSent: true } });
    }

    console.log(`[admin/emails] Batch Sent successfully to ${successCount} teams via Resend.`);
    
    return res.status(200).json({ success: true, message: `Successfully blasted to ${successCount} teams via Resend.`, sent: successCount });

  } catch (err) {
    console.error('[admin/emails] bulk send error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
