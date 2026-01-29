import dotenv from "dotenv";
import { program } from "commander";

// Handle --env-file before anything else
const envFileIdx = process.argv.indexOf("--env-file");
if (envFileIdx !== -1 && process.argv[envFileIdx + 1]) {
  dotenv.config({ path: process.argv[envFileIdx + 1] });
}

const WORKER_URL = process.env.WORKER_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!WORKER_URL || !ADMIN_SECRET) {
  console.error("Missing WORKER_URL or ADMIN_SECRET in environment. Set them via --env-file or export them.");
  process.exit(1);
}

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_SECRET}`,
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

program.name("busk-cats").description("Admin CLI for busk-cats email subscription worker");
program.option("--env-file <path>", "Path to a .env file to load");

program
  .command("send")
  .description("Send an email to all confirmed subscribers on a list")
  .requiredOption("--list <list>", "Mailing list name")
  .requiredOption("--subject <subject>", "Email subject")
  .option("--html <html>", "HTML body as a string")
  .option("--html-file <path>", "Path to an HTML file to use as the body")
  .action(async (opts: { list: string; subject: string; html?: string; htmlFile?: string }) => {
    let htmlBody = opts.html;
    if (!htmlBody && opts.htmlFile) {
      const fs = await import("fs");
      htmlBody = fs.readFileSync(opts.htmlFile, "utf-8");
    }
    if (!htmlBody) {
      console.error("Provide --html or --html-file");
      process.exit(1);
    }
    const result = await apiCall("POST", "/send", {
      subject: opts.subject,
      html: htmlBody,
      list: opts.list,
    });
    console.log(result);
  });

program
  .command("list")
  .description("List subscribers (optionally filtered by mailing list)")
  .option("--list <list>", "Filter by mailing list name")
  .action(async (opts: { list?: string }) => {
    const query = opts.list ? `?list=${encodeURIComponent(opts.list)}` : "";
    const results = (await apiCall("GET", `/admin/list${query}`)) as Array<{
      email: string;
      list: string;
      confirmed: number;
      created_at: string;
    }>;
    if (results.length === 0) {
      console.log("No subscribers.");
      return;
    }
    console.log(`${"EMAIL".padEnd(35)} ${"LIST".padEnd(20)} ${"CONFIRMED".padEnd(10)} CREATED AT`);
    console.log("-".repeat(85));
    for (const s of results) {
      console.log(
        `${s.email.padEnd(35)} ${s.list.padEnd(20)} ${(s.confirmed ? "yes" : "no").padEnd(10)} ${s.created_at}`,
      );
    }
  });

program
  .command("add")
  .description("Add a subscriber directly (skips confirmation email)")
  .requiredOption("--email <email>", "Email to add")
  .requiredOption("--list <list>", "Mailing list name")
  .action(async (opts: { email: string; list: string }) => {
    const result = await apiCall("POST", "/admin/add", { email: opts.email, list: opts.list });
    console.log(result);
  });

program
  .command("delete")
  .description("Delete a subscriber by email (optionally from a specific list)")
  .requiredOption("--email <email>", "Email to delete")
  .option("--list <list>", "Only delete from this list (omit to delete from all lists)")
  .action(async (opts: { email: string; list?: string }) => {
    const body: { email: string; list?: string } = { email: opts.email };
    if (opts.list) body.list = opts.list;
    const result = await apiCall("POST", "/admin/delete", body);
    console.log(result);
  });

program.parse();
