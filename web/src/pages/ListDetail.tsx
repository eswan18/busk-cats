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

  return (
    <div>
      <p><Link to="/lists">← All lists</Link></p>
      <h1 className="mono">{list}</h1>
      {error && <div className="alert error">{error}</div>}
      {!subs ? (
        <p className="muted">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="muted">No subscribers on this list.</p>
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
