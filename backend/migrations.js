// migration.js
const mongoose = require('mongoose');
const Accident = require('./models/Accident');

async function migrateData() {
  await mongoose.connect('mongodb://localhost:27017/accidents');

  const cursor = Accident.find().cursor();
  
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    if (!doc.location && doc.longitude && doc.latitude) {
      doc.location = {
        type: 'Point',
        coordinates: [doc.longitude, doc.latitude]
      };
      await doc.save();
      console.log(`Migrated accident ${doc.crash_id}`);
    }
  }

  console.log('Migration complete');
  process.exit(0);
}

migrateData().catch(console.error);