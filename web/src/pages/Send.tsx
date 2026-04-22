import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";

interface ListSummary { list: string; total: number; confirmed: number }

function buildEmailHtml(opts: {
  title: string;
  subtitle: string;
  link: string;
  siteName: string;
  siteUrl: string;
}): string {
  const subtitleHtml = opts.subtitle
    ? `\n  <p style="font-size: 16px; color: #666; margin: 4px 0 0;">${opts.subtitle}</p>`
    : "";
  return `<!DOCTYPE html>
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
}

export function Send() {
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [list, setList] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [link, setLink] = useState("");
  const [siteName, setSiteName] = useState("ethanswan.com");
  const [siteUrl, setSiteUrl] = useState("https://ethanswan.com");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api<ListSummary[]>("/api/lists").then((ls) => {
      setLists(ls);
      const def = ls.find((l) => l.list === "ethanswan.com") ?? ls[0];
      if (def) setList(def.list);
    }).catch(() => { /* ignore */ });
  }, []);

  const html = useMemo(
    () => buildEmailHtml({ title, subtitle, link, siteName, siteUrl }),
    [title, subtitle, link, siteName, siteUrl],
  );

  const subject = `New Post: ${title}`;

  const currentListCount = lists.find((l) => l.list === list)?.confirmed ?? 0;

  async function onSend() {
    if (!list || !title || !link) {
      setStatus("List, title, and link are required.");
      return;
    }
    const ok = confirm(
      `Send "${subject}" to ${currentListCount} confirmed subscriber(s) on ${list}?`,
    );
    if (!ok) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await api<{ sent: number }>("/api/send", {
        method: "POST",
        body: JSON.stringify({ subject, html, list }),
      });
      setStatus(`Sent to ${res.sent} subscriber(s).`);
    } catch (e) {
      if (e instanceof ApiError) {
        setStatus(`Error: ${JSON.stringify(e.body)}`);
      } else {
        setStatus(String(e));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Send notification</h1>
      <div className="card">
        <div className="field">
          <label>List</label>
          <select value={list} onChange={(e) => setList(e.target.value)}>
            {lists.length === 0 && <option value="">(no lists yet)</option>}
            {lists.map((l) => (
              <option key={l.list} value={l.list}>
                {l.list} ({l.confirmed} confirmed)
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Post title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Subtitle (optional)</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Link to the post</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
        </div>
        <div className="field">
          <label>Site name</label>
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </div>
        <div className="field">
          <label>Site URL</label>
          <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
        </div>
        <p className="muted">Subject: <span className="mono">{subject}</span></p>
      </div>

      <h2>Preview</h2>
      <iframe className="preview-frame" sandbox="" srcDoc={html} title="Email preview" />

      <div className="actions">
        <button disabled={sending || !list || !title || !link} onClick={() => { void onSend(); }}>
          {sending ? "Sending…" : `Send to ${currentListCount} subscriber(s)`}
        </button>
      </div>
      {status && <div className="alert">{status}</div>}
    </div>
  );
}
