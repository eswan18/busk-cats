import { useEffect, useState } from "react";
import { api } from "../api";

interface ListSummary { list: string }

function snippet(workerUrl: string, listName: string): string {
  return `<form id="subscribe-form">
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
        body: JSON.stringify({ email, list: "${listName}" }),
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
</script>`;
}

export function FormSnippet() {
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [list, setList] = useState("ethanswan.com");
  const workerUrl = window.location.origin;

  useEffect(() => {
    api<ListSummary[]>("/api/lists").then(setLists).catch(() => { /* ignore */ });
  }, []);

  const code = snippet(workerUrl, list);

  return (
    <div>
      <h1>Form snippet</h1>
      <div className="field">
        <label>List</label>
        <select value={list} onChange={(e) => setList(e.target.value)}>
          {lists.length === 0 && <option value={list}>{list}</option>}
          {lists.map((l) => (
            <option key={l.list} value={l.list}>{l.list}</option>
          ))}
        </select>
      </div>
      <p className="muted">Paste this into any site to collect subscribers for this list:</p>
      <div className="snippet">{code}</div>
      <div className="actions">
        <button className="secondary" onClick={() => { void navigator.clipboard.writeText(code); }}>
          Copy to clipboard
        </button>
      </div>
    </div>
  );
}
