import { Link, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Lists } from "./pages/Lists";
import { ListDetail } from "./pages/ListDetail";
import { Send } from "./pages/Send";
import { Add } from "./pages/Add";
import { FormSnippet } from "./pages/FormSnippet";

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { me, loading, logout } = useAuth();

  if (loading) {
    return <div className="app"><p className="muted">Loading…</p></div>;
  }

  if (!me) {
    return <div className="app"><Landing /></div>;
  }

  return (
    <div className="app">
      <nav className="nav">
        <Link to="/" className="brand">Busk Cats</Link>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/lists">Lists</NavLink>
        <NavLink to="/send">Send</NavLink>
        <NavLink to="/add">Add</NavLink>
        <NavLink to="/form">Form</NavLink>
        <span className="spacer" />
        <span className="user">{me.username}</span>
        <button className="secondary" onClick={() => { void logout(); }}>Log out</button>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/lists/:name" element={<ListDetail />} />
        <Route path="/send" element={<Send />} />
        <Route path="/add" element={<Add />} />
        <Route path="/form" element={<FormSnippet />} />
        <Route path="*" element={<p>Not found.</p>} />
      </Routes>
    </div>
  );
}
