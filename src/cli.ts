import dotenv from "dotenv";
import { program } from "commander";
import { input, confirm } from "@inquirer/prompts";

// Handle --env-file before anything else
const envFileIdx = process.argv.indexOf("--env-file");
if (envFileIdx !== -1 && process.argv[envFileIdx + 1]) {
  dotenv.config({ path: process.argv[envFileIdx + 1] });
}

// Prompts write to stderr so stdout (the command's actual output) stays clean for redirection.
const PROMPT_CTX = { output: process.stderr } as const;

async function promptText(
  message: string,
  validate: (v: string) => true | string = (v) => v.trim().length > 0 || "Required",
): Promise<string> {
  return input({ message, validate }, PROMPT_CTX);
}

// Fill in any missing fields on `opts` by prompting interactively.
// Each spec names an option key; if the key is missing/empty, prompt for it.
// Returns opts with the prompted keys narrowed to `string`.
async function promptMissing<T extends Record<string, unknown>, K extends keyof T & string>(
  opts: T,
  specs: Array<{ key: K; message: string; validate?: (v: string) => true | string }>,
): Promise<T & { [P in K]: string }> {
  const filled: Record<string, unknown> = { ...opts };
  for (const spec of specs) {
    const current = filled[spec.key];
    if (current === undefined || current === "") {
      filled[spec.key] = await promptText(spec.message, spec.validate);
    }
  }
  return filled as T & { [P in K]: string };
}

function requireEnv(): { workerUrl: string; adminSecret: string } {
  const workerUrl = process.env.WORKER_URL;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!workerUrl || !adminSecret) {
    console.error("Missing WORKER_URL or ADMIN_SECRET in environment. Set them via --env-file or export them.");
    process.exit(1);
  }
  return { workerUrl, adminSecret };
}

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const { workerUrl, adminSecret } = requireEnv();
  const res = await fetch(`${workerUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminSecret}`,
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
  .description("Send a new-post announcement email to all confirmed subscribers on a list")
  .option("--list <list>", "Mailing list name")
  .option("--title <title>", "Post title (used as subject 'New Post: {title}' and heading)")
  .option("--subtitle <subtitle>", "Post subtitle (optional)")
  .option("--link <link>", "Link to the post")
  .option("--site-name <name>", "Website name (e.g. ethanswan.com)")
  .option("--site-url <url>", "Website URL (e.g. https://ethanswan.com)")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(async (rawOpts: {
    list?: string;
    title?: string;
    subtitle?: string;
    link?: string;
    siteName?: string;
    siteUrl?: string;
    yes?: boolean;
  }) => {
    const opts = await promptMissing(rawOpts, [
      { key: "list", message: "Mailing list name:" },
      { key: "title", message: "Post title:" },
      { key: "link", message: "Link to the post:" },
      { key: "siteName", message: "Website name (e.g. ethanswan.com):" },
      { key: "siteUrl", message: "Website URL (e.g. https://ethanswan.com):" },
    ]);
    const subject = `New Post: ${opts.title}`;
    const subtitleHtml = opts.subtitle
      ? `\n  <p style="font-size: 16px; color: #666; margin: 4px 0 0;">${opts.subtitle}</p>`
      : "";
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${opts.title}</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border-top: 4px solid #333;">
  <p style="font-size: 14px; color: #666; margin: 16px 0;">New post on <a href="${opts.siteUrl}" style="color: #666;">${opts.siteName}</a></p>
  <hr style="border: none; border-top: 1px solid #ddd; margin: 0 0 16px;">
  <h1 style="font-size: 24px; margin: 0;">${opts.title}</h1>${subtitleHtml}
  <p style="margin-top: 36px; text-align: center;">
    <a href="${opts.link}" style="display: inline-block; padding: 10px 20px; background-color: #333; color: #fff; text-decoration: none; border-radius: 4px;">Read the Post</a>
  </p>
</body>
</html>`;

    if (!opts.yes) {
      console.error("--- Email preview ---");
      console.error(`List:    ${opts.list}`);
      console.error(`Subject: ${subject}`);
      console.error("Body:");
      console.error(html);
      console.error("---------------------");
      const ok = await confirm({ message: "Send this email?", default: false }, PROMPT_CTX);
      if (!ok) {
        console.error("Cancelled.");
        return;
      }
    }

    const result = (await apiCall("POST", "/send", { subject, html, list: opts.list })) as { sent: number };
    console.log(`Sent to ${result.sent} subscriber(s).`);
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
  .option("--email <email>", "Email to add")
  .option("--list <list>", "Mailing list name")
  .action(async (rawOpts: { email?: string; list?: string }) => {
    const opts = await promptMissing(rawOpts, [
      { key: "email", message: "Email to add:" },
      { key: "list", message: "Mailing list name:" },
    ]);
    const result = await apiCall("POST", "/admin/add", { email: opts.email, list: opts.list });
    console.log(result);
  });

program
  .command("form")
  .description("Generate an HTML subscribe form snippet for a list")
  .option("--list <list>", "Mailing list name")
  .action(async (rawOpts: { list?: string }) => {
    const opts = await promptMissing(rawOpts, [{ key: "list", message: "Mailing list name:" }]);
    const { workerUrl } = requireEnv();
    console.log(`<form id="subscribe-form">
  <input type="email" id="subscribe-email" placeholder="you@example.com" required />
  <button type="submit">Subscribe</button>
</form>
<p id="subscribe-message" style="display:none;"></p>
<script>
  document.getElementById("subscribe-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("subscribe-email").value;
    const msg = document.getElementById("subscribe-message");
    try {
      const res = await fetch("${workerUrl}/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, list: "${opts.list}" }),
      });
      const data = await res.json();
      msg.textContent = data.ok
        ? "Check your email to confirm your subscription."
        : data.error || "Something went wrong.";
    } catch {
      msg.textContent = "Something went wrong.";
    }
    msg.style.display = "block";
  });
</script>`);
  });

program
  .command("delete")
  .description("Delete a subscriber by email (optionally from a specific list)")
  .option("--email <email>", "Email to delete")
  .option("--list <list>", "Only delete from this list (omit to delete from all lists)")
  .action(async (rawOpts: { email?: string; list?: string }) => {
    const opts = await promptMissing(rawOpts, [{ key: "email", message: "Email to delete:" }]);
    const body: { email: string; list?: string } = { email: opts.email };
    if (opts.list) body.list = opts.list;
    const result = await apiCall("POST", "/admin/delete", body);
    console.log(result);
  });

program.parse();
