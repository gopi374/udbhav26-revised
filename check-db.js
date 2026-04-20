import { connectDB } from './api/lib/mongodb.js';
import { Registration } from './api/models/Registration.js';
import { Team } from './api/models/Team.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await connectDB();
  const r = await Registration.findOne({ teamCode: 'UDB-V9A7' }).lean();
  console.log('--- Registration ---');
  console.log(r ? { id: r._id, teamCode: r.teamCode, paymentStatus: r.paymentStatus } : 'Not found');

  const t = await Team.findOne({ code: 'UDB-V9A7' }).lean();
  console.log('--- Team ---');
  console.log(t ? { id: t._id, code: t.code, paymentStatus: t.paymentStatus } : 'Not found');
  
  process.exit(0);
}

run().catch(console.error);
