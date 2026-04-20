import { connectDB } from './api/lib/mongodb.js';
import { Registration } from './api/models/Registration.js';
import { Team } from './api/models/Team.js';
import dotenv from 'dotenv';
dotenv.config();

async function syncDB() {
  await connectDB();
  const regs = await Registration.find().lean();
  let updated = 0;

  for (const r of regs) {
    if (!r.teamCode) continue;
    const t = await Team.findOne({ code: r.teamCode }).lean();
    if (t && t.paymentStatus !== r.paymentStatus) {
      console.log(`Syncing ${r.teamCode} from Registration (${r.paymentStatus}) to Team (${t.paymentStatus})`);
      await Team.updateOne({ code: r.teamCode }, { $set: { paymentStatus: r.paymentStatus } });
      updated++;
    }
  }
  
  console.log(`Synced ${updated} teams.`);
  process.exit(0);
}

syncDB().catch(console.error);
