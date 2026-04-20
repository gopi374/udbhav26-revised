import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
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
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    totalAmount: { type: Number, default: 800 },
  },
  { timestamps: true, collection: 'teams' }
);

const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const dummyTeams = [
      {
        code: 'UDB-TEST01',
        codeGenerated: true,
        teamName: 'Alpha Coders',
        collegeName: 'NIT Trichy',
        branch: 'Computer Science',
        memberCount: 3,
        leader: { name: 'Alice Smith', email: 'alice@example.com', phone: '9876543210' },
        paymentStatus: 'pending',
        totalAmount: 800
      },
      {
        code: 'UDB-TEST02',
        codeGenerated: true,
        teamName: 'Beta Builders',
        collegeName: 'IIT Madras',
        branch: 'Electrical',
        memberCount: 4,
        leader: { name: 'Bob Jones', email: 'bob@example.com', phone: '8765432109' },
        paymentStatus: 'pending',
        totalAmount: 1100
      },
      {
        code: 'UDB-TEST03',
        codeGenerated: true,
        teamName: 'Gamma Hackers',
        collegeName: 'BITS Pilani',
        branch: 'Mechanical',
        memberCount: 2,
        leader: { name: 'Charlie Dave', email: 'charlie@example.com', phone: '7654321098' },
        paymentStatus: 'pending',
        totalAmount: 800
      },
      {
        code: 'UDB-TEST04',
        codeGenerated: true,
        teamName: 'Delta Devs',
        collegeName: 'VIT Vellore',
        branch: 'Information Technology',
        memberCount: 4,
        leader: { name: 'Diana Prince', email: 'diana@example.com', phone: '6543210987' },
        paymentStatus: 'pending',
        totalAmount: 1100
      }
    ];

    for (const team of dummyTeams) {
      await Team.findOneAndUpdate({ code: team.code }, team, { upsert: true, new: true });
      console.log(`Inserted team ${team.code}`);
    }

    console.log('Successfully inserted dummy teams.');
    process.exit(0);
  } catch (error) {
    console.error('Error inserting teams:', error);
    process.exit(1);
  }
}

run();
