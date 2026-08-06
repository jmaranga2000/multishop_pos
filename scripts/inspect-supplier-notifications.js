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

  const supplierHistories = await db.collection('supplierNotificationHistory').find({}).sort({ createdAt: -1 }).limit(10).project({ supplierId: 1, businessId: 1, shopId: 1, emailAddress: 1, subject: 1, status: 1, pdfUrl: 1, pdfToken: 1, referenceNumber: 1, createdAt: 1 }).toArray();
  const supplierEmailQueue = await db.collection('emailQueue').find({ subject: { $regex: /restock|supplier|purchase request|quote|quotation/i } }).sort({ createdAt: -1 }).limit(20).project({ recipient: 1, subject: 1, status: 1, attachments: 1, createdAt: 1, lastError: 1 }).toArray();
  const supplierEmailCount = await db.collection('emailQueue').countDocuments({ subject: { $regex: /restock|supplier|purchase request|quote|quotation/i } });

  console.log(JSON.stringify({ supplierHistories, supplierEmailCount, supplierEmailQueue }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
