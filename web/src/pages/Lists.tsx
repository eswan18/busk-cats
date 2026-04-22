import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

interface ListSummary {
  list: string;
  total: number;
  confirmed: number;
}

export function Lists() {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
      <p className="muted">
        Pick a list to send, add subscribers, or copy a subscribe form.{" "}
        <Link to="/new-list">How to create a new list →</Link>
      </p>
      {lists.length === 0 ? (
        <p className="muted">No lists yet. A list is created when its first subscriber is added.</p>
      ) : (
        <table className="clickable">
          <thead>
            <tr>
              <th>List</th>
              <th>Total</th>
              <th>Confirmed</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr
                key={l.list}
                onClick={() => navigate(`/list/${encodeURIComponent(l.list)}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/list/${encodeURIComponent(l.list)}`);
                  }
                }}
              >
                <td className="mono">{l.list}</td>
                <td>{l.total}</td>
                <td>{l.confirmed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
