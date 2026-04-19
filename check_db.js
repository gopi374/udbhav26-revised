import { connectDB, disconnectDB } from './api/lib/mongodb.js';
import { Team } from './api/models/Team.js';
import { Registration } from './api/models/Registration.js';

async function run() {
  try {
    await connectDB();
    const teamCount = await Team.countDocuments();
    const regCount = await Registration.countDocuments();
    console.log(`Teams count: ${teamCount}`);
    console.log(`Registrations count: ${regCount}`);

    const teams = await Team.find().limit(2).lean();
    console.log('Sample teams:', JSON.stringify(teams, null, 2));

    const regs = await Registration.find().limit(2).lean();
    console.log('Sample registrations:', JSON.stringify(regs, null, 2));

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
