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
  const email = 'evansmaranga30@gmail.com';
  const supplier = await db.collection('suppliers').findOne({ email });
  const histories = await db.collection('supplierNotificationHistory').find({ emailAddress: email }).sort({ createdAt: -1 }).limit(10).toArray();
  const queuedEmails = await db.collection('emailQueue').find({ recipient: email }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(JSON.stringify({ supplier, histories, queuedEmails }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
