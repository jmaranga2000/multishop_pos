import * as dotenv from "dotenv";
import { getQStashClient, getQStashDestination } from "../src/lib/qstash";

dotenv.config({ path: ".env.local" });
dotenv.config();

type QStashSchedule = {
  id: string;
  path: string;
  cron: string;
  timeoutSeconds: number;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function upsertSchedule(schedule: QStashSchedule) {
  const result = await getQStashClient().schedules.create({
    destination: getQStashDestination(schedule.path),
    body: JSON.stringify({ schedule: schedule.id }),
    headers: { "Content-Type": "application/json" },
    cron: schedule.cron,
    scheduleId: schedule.id,
    retries: 3,
    timeout: schedule.timeoutSeconds,
  });
  console.log(`${schedule.id}: ${result.scheduleId} ? ${schedule.cron}`);
}

async function main() {
  required("QSTASH_TOKEN");
  required("QSTASH_CURRENT_SIGNING_KEY");
  required("QSTASH_NEXT_SIGNING_KEY");

  const schedules: QStashSchedule[] = [
    {
      id: "multishop-pos-notification-queue-v1",
      path: "/api/jobs/process-queues",
      cron: process.env.QSTASH_NOTIFICATION_CRON?.trim() || "* * * * *",
      timeoutSeconds: 60,
    },
    {
      id: "multishop-pos-supplier-restock-sweep-v1",
      path: "/api/jobs/supplier-restock-sweep",
      cron: process.env.QSTASH_SUPPLIER_RESTOCK_CRON?.trim() || "*/15 * * * *",
      timeoutSeconds: 60,
    },
    {
      id: "multishop-pos-daily-shop-summary-v1",
      path: "/api/jobs/daily-shop-summary",
      cron: process.env.QSTASH_DAILY_SUMMARY_CRON?.trim() || "CRON_TZ=Africa/Nairobi 0 21 * * *",
      timeoutSeconds: 300,
    },
    {
      id: "multishop-pos-weekly-inventory-v1",
      path: "/api/jobs/weekly-inventory",
      cron: process.env.QSTASH_WEEKLY_INVENTORY_CRON?.trim() || "CRON_TZ=Africa/Nairobi 0 8 * * 1",
      timeoutSeconds: 300,
    },
  ];

  for (const schedule of schedules) await upsertSchedule(schedule);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});