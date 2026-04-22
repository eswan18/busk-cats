import type { Env } from "./env";

export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject,
      html: htmlBody,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error: ${res.status} ${text}`);
  }
}

export async function sendToList(
  env: Env,
  subscribers: Array<{ email: string; token: string }>,
  subject: string,
  htmlBody: string,
): Promise<number> {
  const BATCH_SIZE = 10;
  let sent = 0;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((sub) => {
        const unsubLink = `${env.WORKER_URL}/unsubscribe?token=${sub.token}`;
        const unsubBlock = `<p style="margin-top:2em;font-size:0.85em;color:#666;"><a href="${unsubLink}">Unsubscribe</a></p>`;
        const fullHtml = htmlBody.includes("</body>")
          ? htmlBody.replace("</body>", `${unsubBlock}</body>`)
          : `${htmlBody}${unsubBlock}`;
        return sendEmail(env, sub.email, subject, fullHtml);
      }),
    );
    sent += batch.length;
  }
  return sent;
}
