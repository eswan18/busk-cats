import { useState } from "react";
import { Link } from "react-router-dom";

export function NewList() {
  const [listName, setListName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ list: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, list: listName }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResult({ list: listName, email });
        setListName("");
        setEmail("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p><Link to="/">← All lists</Link></p>
      <h1>Create a new list</h1>

      <div className="prose">
        <p>
          Lists aren't separate records in the database — they come into existence the
          moment someone subscribes to them. To create one, use this form to subscribe
          an email (usually your own) to a new list name.
        </p>
        <p>
          This form posts to the same public <span className="mono">/subscribe</span>{" "}
          endpoint that subscribe-form embeds on other sites use, so the address you
          enter will receive a confirmation email and only counts as a real subscriber
          after clicking through. The list itself will show up on the Lists page as
          soon as you submit, even before confirmation.
        </p>
        <p className="muted">
          Once the list exists, you can use its page to add more subscribers (with or
          without confirmation) and send notifications.
        </p>
      </div>

      <form onSubmit={(e) => { void onSubmit(e); }} className="card">
        <div className="field">
          <label>New list name</label>
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="e.g. mynewsite.com"
            required
          />
        </div>
        <div className="field">
          <label>Your email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="actions">
          <button disabled={submitting}>
            {submitting ? "Subscribing…" : "Subscribe"}
          </button>
        </div>
      </form>

      {error && <div className="alert error">Error: {error}</div>}
      {result && (
        <div className="alert success">
          List <span className="mono">{result.list}</span> is live. A confirmation
          email has been sent to <strong>{result.email}</strong>.{" "}
          <Link to={`/list/${encodeURIComponent(result.list)}`}>Open the list →</Link>
        </div>
      )}
    </div>
  );
}
