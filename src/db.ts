export interface Subscriber {
  email: string;
  list: string;
  confirmed: number;
  created_at: string;
}

export interface ListSummary {
  list: string;
  total: number;
  confirmed: number;
}

export async function insertPendingSubscriber(
  db: D1Database,
  email: string,
  list: string,
  token: string,
): Promise<{ ok: true } | { error: "duplicate" }> {
  try {
    await db
      .prepare("INSERT INTO subscribers (email, list, token) VALUES (?, ?, ?)")
      .bind(email, list, token)
      .run();
    return { ok: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return { error: "duplicate" };
    }
    throw e;
  }
}

export async function insertConfirmedSubscriber(
  db: D1Database,
  email: string,
  list: string,
  token: string,
): Promise<{ ok: true } | { error: "duplicate" }> {
  try {
    await db
      .prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind(email, list, token)
      .run();
    return { ok: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return { error: "duplicate" };
    }
    throw e;
  }
}

export async function confirmSubscriber(db: D1Database, token: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE subscribers SET confirmed = 1 WHERE token = ?")
    .bind(token)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteByToken(db: D1Database, token: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM subscribers WHERE token = ?").bind(token).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteByEmail(
  db: D1Database,
  email: string,
  list?: string,
): Promise<number> {
  const result = list
    ? await db
        .prepare("DELETE FROM subscribers WHERE email = ? AND list = ?")
        .bind(email, list)
        .run()
    : await db.prepare("DELETE FROM subscribers WHERE email = ?").bind(email).run();
  return result.meta.changes ?? 0;
}

export async function listSubscribers(db: D1Database, list?: string): Promise<Subscriber[]> {
  const { results } = list
    ? await db
        .prepare(
          "SELECT email, list, confirmed, created_at FROM subscribers WHERE list = ? ORDER BY created_at DESC",
        )
        .bind(list)
        .all<Subscriber>()
    : await db
        .prepare(
          "SELECT email, list, confirmed, created_at FROM subscribers ORDER BY created_at DESC",
        )
        .all<Subscriber>();
  return results;
}

export async function listListSummaries(db: D1Database): Promise<ListSummary[]> {
  const { results } = await db
    .prepare(
      "SELECT list, COUNT(*) AS total, SUM(confirmed) AS confirmed FROM subscribers GROUP BY list ORDER BY list",
    )
    .all<{ list: string; total: number; confirmed: number }>();
  return results.map((r) => ({ list: r.list, total: r.total, confirmed: r.confirmed ?? 0 }));
}

export async function getConfirmedSubscribers(
  db: D1Database,
  list: string,
): Promise<Array<{ email: string; token: string }>> {
  const { results } = await db
    .prepare("SELECT email, token FROM subscribers WHERE confirmed = 1 AND list = ?")
    .bind(list)
    .all<{ email: string; token: string }>();
  return results;
}

export interface SentNotification {
  id: number;
  list: string;
  subject: string;
  html: string;
  post_link: string | null;
  recipient_count: number;
  sent_by: string;
  created_at: string;
}

export async function insertSentNotification(
  db: D1Database,
  row: {
    list: string;
    subject: string;
    html: string;
    post_link: string | null;
    recipient_count: number;
    sent_by: string;
  },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO sent_notifications (list, subject, html, post_link, recipient_count, sent_by) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(row.list, row.subject, row.html, row.post_link, row.recipient_count, row.sent_by)
    .run();
}

export async function listSentNotifications(
  db: D1Database,
  list?: string,
): Promise<SentNotification[]> {
  const { results } = list
    ? await db
        .prepare(
          "SELECT id, list, subject, html, post_link, recipient_count, sent_by, created_at FROM sent_notifications WHERE list = ? ORDER BY created_at DESC, id DESC",
        )
        .bind(list)
        .all<SentNotification>()
    : await db
        .prepare(
          "SELECT id, list, subject, html, post_link, recipient_count, sent_by, created_at FROM sent_notifications ORDER BY created_at DESC, id DESC",
        )
        .all<SentNotification>();
  return results;
}
