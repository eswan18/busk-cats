import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface ListSummary {
  list: string;
  total: number;
  confirmed: number;
}

export function Lists() {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ListSummary[]>("/api/lists")
      .then(setLists)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!lists) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>Lists</h1>
      {lists.length === 0 ? (
        <p className="muted">No lists yet. A list is created when its first subscriber is added.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>List</th>
              <th>Total</th>
              <th>Confirmed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr key={l.list}>
                <td className="mono">{l.list}</td>
                <td>{l.total}</td>
                <td>{l.confirmed}</td>
                <td><Link to={`/lists/${encodeURIComponent(l.list)}`}>View subscribers</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
