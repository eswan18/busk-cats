import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

interface SentNotification {
  id: number;
  list: string;
  subject: string;
  html: string;
  post_link: string | null;
  recipient_count: number;
  sent_by: string;
  created_at: string;
}

export function History() {
  const { name } = useParams();
  const list = name ?? "";
  const [rows, setRows] = useState<SentNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    setError(null);
    api<SentNotification[]>(`/api/sent?list=${encodeURIComponent(list)}`)
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, [list]);

  return (
    <div>
      <p><Link to={`/list/${encodeURIComponent(list)}`}>← {list}</Link></p>
      <h1>Sent history</h1>
      <p className="muted">List: <span className="mono">{list}</span></p>

      {error && <div className="alert error">{error}</div>}
      {!rows ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No notifications sent on this list yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Sent</th>
              <th>Subject</th>
              <th>Recipients</th>
              <th>By</th>
              <th>Link</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="muted mono">{r.created_at}</td>
                  <td>{r.subject}</td>
                  <td>{r.recipient_count}</td>
                  <td className="mono">{r.sent_by}</td>
                  <td>
                    {r.post_link ? (
                      <a href={r.post_link} target="_blank" rel="noreferrer">link</a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    >
                      {openId === r.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {openId === r.id && (
                  <tr>
                    <td colSpan={6}>
                      <iframe
                        className="preview-frame"
                        sandbox=""
                        srcDoc={r.html}
                        title={`Email preview ${r.id}`}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
