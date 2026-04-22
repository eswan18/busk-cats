import { useEffect, useState } from "react";
import { api, ApiError } from "../api";

interface ListSummary { list: string }

export function Add() {
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [email, setEmail] = useState("");
  const [list, setList] = useState("");
  const [customList, setCustomList] = useState("");
  const [skipConfirmation, setSkipConfirmation] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<ListSummary[]>("/api/lists").then((ls) => {
      setLists(ls);
      const def = ls.find((l) => l.list === "ethanswan.com") ?? ls[0];
      if (def) setList(def.list);
    }).catch(() => { /* ignore */ });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    const targetList = list === "__new__" ? customList.trim() : list;
    if (!targetList) {
      setStatus("Pick or enter a list.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await api<{ ok: true; confirmed: boolean }>("/api/subscribers", {
        method: "POST",
        body: JSON.stringify({ email, list: targetList, skipConfirmation }),
      });
      setStatus(
        res.confirmed
          ? `Added ${email} to ${targetList} (pre-confirmed).`
          : `Confirmation email sent to ${email} for ${targetList}.`,
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
      <h1>Add subscriber</h1>
      <form onSubmit={(e) => { void onSubmit(e); }} className="card">
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>List</label>
          <select value={list} onChange={(e) => setList(e.target.value)}>
            {lists.map((l) => (
              <option key={l.list} value={l.list}>{l.list}</option>
            ))}
            <option value="__new__">+ new list…</option>
          </select>
        </div>
        {list === "__new__" && (
          <div className="field">
            <label>New list name</label>
            <input value={customList} onChange={(e) => setCustomList(e.target.value)} />
          </div>
        )}
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
