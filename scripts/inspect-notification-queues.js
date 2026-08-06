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
  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  const emailCount = await db.collection('emailQueue').countDocuments();
  const pushCount = await db.collection('pushNotificationQueue').countDocuments();
  const notifCount = await db.collection('notifications').countDocuments();
  const subscriptionsCount = await db.collection('pushSubscriptions').countDocuments();
  const emailSample = await db.collection('emailQueue').find({}).sort({ createdAt: -1 }).limit(5).project({ recipient: 1, subject: 1, type: 1, status: 1, createdAt: 1 }).toArray();
  const pushSample = await db.collection('pushNotificationQueue').find({}).sort({ createdAt: -1 }).limit(5).project({ userId: 1, title: 1, body: 1, status: 1, createdAt: 1 }).toArray();
  const notifSample = await db.collection('notifications').find({}).sort({ createdAt: -1 }).limit(5).project({ userId: 1, title: 1, message: 1, type: 1, createdAt: 1 }).toArray();
  const tokenEmails = await db.collection('supplierNotificationHistory').find({ emailAddress: { $exists: true }, pdfUrl: { $exists: true } }).sort({ createdAt: -1 }).limit(5).project({ supplierId: 1, emailAddress: 1, pdfUrl: 1, status: 1, createdAt: 1 }).toArray();
  console.log(JSON.stringify({ collections: names, emailCount, pushCount, notifCount, subscriptionsCount, emailSample, pushSample, notifSample, tokenEmails }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
