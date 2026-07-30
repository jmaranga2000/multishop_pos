import * as dotenv from "dotenv";
import { getAdminDashboardData } from "../src/services/admin/dashboard-service";
import { db } from "../src/lib/db";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  try {
    const business = await db.business.findFirst({ where: { code: "DEMO-BUSINESS" } });
    if (!business) {
      console.error("Demo business not found");
      process.exit(1);
    }
    const data = await getAdminDashboardData(business.id);
    console.log("Dashboard data fetched successfully:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    if (err instanceof Error) console.error(err.stack);
    process.exitCode = 1;
  } finally {
    try { await (await import("../src/lib/mongodb")).disconnectFromMongoDB(); } catch {};
  }
}

main();
