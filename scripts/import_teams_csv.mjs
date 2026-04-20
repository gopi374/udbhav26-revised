import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TeamSchema = new mongoose.Schema(
  {
    code: { type: String, default: null, uppercase: true, trim: true },
    codeGenerated: { type: Boolean, default: false },
    teamName: { type: String, required: true, trim: true },
    collegeName: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    memberCount: { type: Number, required: true, min: 1, max: 4, default: 1 },
    leader: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
    },
    members: [
      {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        email: { type: String, default: '', trim: true }
      }
    ],
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    totalAmount: { type: Number, default: 800 },
  },
  { timestamps: true, collection: 'teams' }
);

const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

function parseCSVLine(text) {
  let p = '', row = [''], i = 0, r = 0, s = !0, l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (',' === l && s) l = row[++i] = '';
    else row[i] += l;
    p = l;
  }
  return row;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const csvContent = fs.readFileSync(path.resolve(__dirname, '../full_csv2.csv'), 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    const headers = parseCSVLine(lines[0]);

    const codeIdx = headers.findIndex(h => h === 'Team ID');
    const teamNameIdx = headers.findIndex(h => h === 'Team Name');
    const nameIdx = headers.findIndex(h => h === "Candidate's Name");
    const emailIdx = headers.findIndex(h => h === "Candidate's Email");
    const phoneIdx = headers.findIndex(h => h === "Candidate's Mobile");
    const orgIdx = headers.findIndex(h => h === "Candidate's Organisation");
    const deptIdx = headers.findIndex(h => h === "Course Specialization");
    const typeIdx = headers.findIndex(h => h === "User Type");

    const teamsMap = new Map();

    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (!row || row.length < headers.length) continue;

        const code = row[codeIdx]?.trim();
        const teamName = row[teamNameIdx]?.trim();
        const name = row[nameIdx]?.trim();
        const email = row[emailIdx]?.trim();
        // Extract only digits from phone
        let phone = row[phoneIdx]?.trim() || '';
        if (phone.startsWith('91') && phone.length === 12) {
          phone = phone.slice(2);
        }

        const org = row[orgIdx]?.trim() || 'N/A';
        const dept = row[deptIdx]?.trim() || 'N/A';
        const userType = row[typeIdx]?.trim();

        if (!code) continue;

        if (!teamsMap.has(code)) {
            teamsMap.set(code, {
                code,
                codeGenerated: true,
                teamName,
                collegeName: org,
                branch: dept,
                memberCount: 0,
                leader: { name: '', email: '', phone: '' },
                members: [],
                paymentStatus: 'pending',
                totalAmount: 800
            });
        }

        const teamData = teamsMap.get(code);

        if (userType === 'Team Leader') {
            teamData.leader = { name, email, phone };
        } else {
            teamData.members.push({ name, email, phone });
        }
        teamData.memberCount++;
    }

    // Determine amount (800 for up to 3 members, 1100 for 4 members)
    for (const [code, team] of teamsMap) {
        team.totalAmount = team.memberCount > 3 ? 1100 : 800; // Actually wait, 4 members = leader + 3. Let's make it depending on leader + members.
        if (!team.leader.name && team.members.length > 0) {
           // Fallback if no leader
           const l = team.members.shift();
           team.leader = l;
           team.memberCount--;
        }
        console.log(`Upserting ${code} - ${team.teamName} with ${team.members.length} members`);
        await Team.findOneAndUpdate({ code }, team, { upsert: true, new: true });
    }

    console.log('Successfully inserted all teams from CSV.');
    process.exit(0);

  } catch (err) {
    console.error('Error importing:', err);
    process.exit(1);
  }
}

run();
