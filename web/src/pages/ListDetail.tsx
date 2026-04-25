import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

interface Subscriber {
  email: string;
  list: string;
  confirmed: number;
  created_at: string;
}

export function ListDetail() {
  const { name } = useParams();
  const list = name ?? "";
  const [subs, setSubs] = useState<Subscriber[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<Subscriber[]>(`/api/subscribers?list=${encodeURIComponent(list)}`)
      .then(setSubs)
      .catch((e) => setError(String(e)));
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(email: string) {
    if (!confirm(`Delete ${email} from ${list}?`)) return;
    try {
      await api("/api/subscribers", {
        method: "DELETE",
        body: JSON.stringify({ email, list }),
      });
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  const encoded = encodeURIComponent(list);

  return (
    <div>
      <p><Link to="/">← All lists</Link></p>
      <h1 className="mono">{list}</h1>

      <div className="list-actions">
        <Link to={`/list/${encoded}/send`} className="list-action">
          <h3>Send notification</h3>
          <p>Email a new-post announcement.</p>
        </Link>
        <Link to={`/list/${encoded}/add`} className="list-action">
          <h3>Add subscriber</h3>
          <p>Add someone to this list.</p>
        </Link>
        <Link to={`/list/${encoded}/form`} className="list-action">
          <h3>Form snippet</h3>
          <p>Generate subscribe HTML.</p>
        </Link>
        <Link to={`/list/${encoded}/history`} className="list-action">
          <h3>Sent history</h3>
          <p>See past notifications.</p>
        </Link>
      </div>

      <h2 style={{ marginTop: "2.5rem" }}>Subscribers</h2>
      {error && <div className="alert error">{error}</div>}
      {!subs ? (
        <p className="muted">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="muted">No subscribers on this list yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Confirmed</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.email}>
                <td>{s.email}</td>
                <td>
                  {s.confirmed ? <span className="pill yes">yes</span> : <span className="pill no">no</span>}
                </td>
                <td className="muted mono">{s.created_at}</td>
                <td>
                  <button className="danger" onClick={() => { void onDelete(s.email); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
