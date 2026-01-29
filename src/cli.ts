import "dotenv/config";
import { program } from "commander";

const WORKER_URL = process.env.WORKER_URL;
const SEND_SECRET = process.env.SEND_SECRET;

if (!WORKER_URL || !SEND_SECRET) {
  console.error("Missing WORKER_URL or SEND_SECRET in environment. Set them in .env or export them.");
  process.exit(1);
}

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SEND_SECRET}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Error ${res.status}:`, data);
    process.exit(1);
  }
  return data;
}

program.name("cli").description("Admin CLI for email-subscribe worker");

program
  .command("send")
  .description("Send an email to all confirmed subscribers")
  .requiredOption("--subject <subject>", "Email subject")
  .option("--html <html>", "HTML body as a string")
  .option("--html-file <path>", "Path to an HTML file to use as the body")
  .action(async (opts: { subject: string; html?: string; htmlFile?: string }) => {
    let htmlBody = opts.html;
    if (!htmlBody && opts.htmlFile) {
      const fs = await import("fs");
      htmlBody = fs.readFileSync(opts.htmlFile, "utf-8");
    }
    if (!htmlBody) {
      console.error("Provide --html or --html-file");
      process.exit(1);
    }
    const result = await apiCall("POST", "/send", { subject: opts.subject, html: htmlBody });
    console.log(result);
  });

program
  .command("list")
  .description("List all subscribers")
  .action(async () => {
    const results = (await apiCall("GET", "/admin/list")) as Array<{
      email: string;
      confirmed: number;
      created_at: string;
    }>;
    if (results.length === 0) {
      console.log("No subscribers.");
      return;
    }
    console.log(`${"EMAIL".padEnd(40)} ${"CONFIRMED".padEnd(10)} CREATED AT`);
    console.log("-".repeat(70));
    for (const s of results) {
      console.log(
        `${s.email.padEnd(40)} ${(s.confirmed ? "yes" : "no").padEnd(10)} ${s.created_at}`,
      );
    }
  });

program
  .command("delete")
  .description("Delete a subscriber by email")
  .requiredOption("--email <email>", "Email to delete")
  .action(async (opts: { email: string }) => {
    const result = await apiCall("POST", "/admin/delete", { email: opts.email });
    console.log(result);
  });

program.parse();
