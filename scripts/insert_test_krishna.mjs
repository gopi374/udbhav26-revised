import { connectDB } from '../api/lib/mongodb.js';
import mongoose from 'mongoose';

const data = {
  "_id": new mongoose.Types.ObjectId("69e4fe9d32d9c24d5d453a25"),
  "code": "TEST-krishna",
  "__v": 0,
  "branch": "Information Technology",
  "codeGenerated": true,
  "collegeName": "Shri Vile Parle Kelavani Mandal's (SVKM) Institute of Technology, Dhule, Maharashtra",
  "createdAt": new Date("2026-04-19T16:11:09.254Z"),
  "leader": {
    "name": "krishna ain",
    "email": "jainshraddha092@gmail.com",
    "phone": "9579225641"
  },
  "memberCount": 4,
  "members": [
    {
      "name": "Gayatri Patil",
      "phone": "9309903343",
      "email": "gayatrip2628@gmail.com",
      "_id": new mongoose.Types.ObjectId("69e4fe9d239c02060d076c5e")
    }
  ],
  "paymentStatus": "pending",
  "teamName": "Technomind",
  "totalAmount": 1100,
  "updatedAt": new Date("2026-04-19T16:11:09.254Z")
};

async function run() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Use raw native collection to bypass Mongoose schema restrictions and exact _id mapping
    const db = mongoose.connection.db;
    
    // Remove if it exists
    await db.collection('teams').deleteOne({ _id: data._id });
    // Remove if it exists by code to be safe
    await db.collection('teams').deleteOne({ code: data.code });
    
    // Insert fresh exactly as requested
    await db.collection('teams').insertOne(data);
    
    console.log(`Successfully mapped EXACT data payload into Atlas under team ${data.code} with _id ${data._id}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
