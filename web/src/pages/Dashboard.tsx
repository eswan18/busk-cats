import { Link } from "react-router-dom";

export function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p className="muted">Choose an action.</p>
      <div className="dashboard-grid">
        <Link to="/send">
          <h3>Send notification</h3>
          <p>Email a new-post announcement to a list.</p>
        </Link>
        <Link to="/lists">
          <h3>Lists</h3>
          <p>See all lists and their subscriber counts.</p>
        </Link>
        <Link to="/add">
          <h3>Add subscriber</h3>
          <p>Pre-confirm an email on a list.</p>
        </Link>
        <Link to="/form">
          <h3>Form snippet</h3>
          <p>Generate an HTML subscribe form.</p>
        </Link>
      </div>
    </div>
  );
}
