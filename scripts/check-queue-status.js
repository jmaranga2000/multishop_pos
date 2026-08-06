const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('NO_ENV');
  process.exit(1);
}

dotenv.config({ path: envPath });
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('NO_URI');
  process.exit(1);
}

async function main() {
  const dbName = new URL(uri).pathname.slice(1);
  await mongoose.connect(uri, { dbName, connectTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const emailStatus = await db.collection('emailQueue').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
  const pushStatus = await db.collection('pushNotificationQueue').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
  const failEmails = await db.collection('emailQueue').find({ status: 'FAILED' }).limit(5).project({ recipient: 1, subject: 1, lastError: 1, scheduledFor: 1 }).toArray();
  const failPush = await db.collection('pushNotificationQueue').find({ status: 'FAILED' }).limit(5).project({ userId: 1, title: 1, lastError: 1, scheduledFor: 1 }).toArray();
  console.log(JSON.stringify({ emailStatus, pushStatus, failEmails, failPush }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
