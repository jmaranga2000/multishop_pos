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

const appUrl = process.argv[2] || process.env.APP_URL || 'http://localhost:3000';
const cron = process.env.CRON_SECRET;
if (!cron) {
  console.error('NO_CRON_SECRET');
  process.exit(1);
}

async function main() {
  const endpoint = `${appUrl.replace(/\/$/, '')}/api/jobs/process-queues`;
  console.log('Calling', endpoint);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cron}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('HTTP ERROR:', error instanceof Error ? error.message : String(error));
    response = null;
  }

  console.log('HTTP status:', response.status);
  const body = await response.text();
  console.log('Response body:', body);

  const dbName = new URL(uri).pathname.slice(1);
  await mongoose.connect(uri, { dbName, connectTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const emailStatus = await db.collection('emailQueue').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
  const pushStatus = await db.collection('pushNotificationQueue').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
  const failedEmails = await db.collection('emailQueue').find({ status: 'FAILED' }).limit(10).project({ recipient: 1, subject: 1, lastError: 1, scheduledFor: 1 }).toArray();
  const failedPush = await db.collection('pushNotificationQueue').find({ status: 'FAILED' }).limit(10).project({ userId: 1, title: 1, lastError: 1, scheduledFor: 1 }).toArray();
  await mongoose.disconnect();

  console.log(JSON.stringify({ emailStatus, pushStatus, failedEmails, failedPush }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
