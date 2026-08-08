import { createECDH, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, ".env.local");
const example = path.join(root, ".env.example");

let contents;
try {
  contents = await fs.readFile(target, "utf8");
} catch {
  contents = await fs.readFile(example, "utf8");
}

function setValue(name, value) {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const line = `${name}="${escaped}"`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  contents = pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.trimEnd()}\n${line}\n`;
}

const vapidCurve = createECDH("prime256v1");
vapidCurve.generateKeys();
setValue("AUTH_SECRET", randomBytes(48).toString("base64url"));
setValue("NEXTAUTH_SECRET", randomBytes(48).toString("base64url"));
setValue("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapidCurve.getPublicKey().toString("base64url"));
setValue("VAPID_PRIVATE_KEY", vapidCurve.getPrivateKey().toString("base64url"));
setValue("VAPID_SUBJECT", "mailto:jmaranga35@gmail.com");

await fs.writeFile(target, contents, { encoding: "utf8", mode: 0o600 });
console.log("Generated fresh local authentication and VAPID secrets in .env.local.");
