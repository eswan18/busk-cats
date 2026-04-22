import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api";

export function Add() {
  const { name } = useParams();
  const list = name ?? "";
  const [email, setEmail] = useState("");
  const [skipConfirmation, setSkipConfirmation] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await api<{ ok: true; confirmed: boolean }>("/api/subscribers", {
        method: "POST",
        body: JSON.stringify({ email, list, skipConfirmation }),
      });
      setStatus(
        res.confirmed
          ? `Added ${email} to ${list} (pre-confirmed).`
          : `Confirmation email sent to ${email} for ${list}.`,
      );
      setEmail("");
    } catch (e) {
      if (e instanceof ApiError) {
        setStatus(`Error: ${JSON.stringify(e.body)}`);
      } else {
        setStatus(String(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p><Link to={`/list/${encodeURIComponent(list)}`}>← {list}</Link></p>
      <h1>Add subscriber</h1>
      <p className="muted">List: <span className="mono">{list}</span></p>

      <form onSubmit={(e) => { void onSubmit(e); }} className="card">
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={skipConfirmation}
            onChange={(e) => setSkipConfirmation(e.target.checked)}
          />
          <span>
            <strong>Skip confirmation email</strong>
            <span className="muted"> — add the email as pre-confirmed. Uncheck to send them a double opt-in link.</span>
          </span>
        </label>
        <div className="actions">
          <button disabled={submitting}>{submitting ? "Adding…" : "Add"}</button>
        </div>
      </form>
      {status && <div className="alert">{status}</div>}
    </div>
  );
}
