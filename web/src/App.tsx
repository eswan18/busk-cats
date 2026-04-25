import { Link, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { Landing } from "./pages/Landing";
import { Lists } from "./pages/Lists";
import { ListDetail } from "./pages/ListDetail";
import { Send } from "./pages/Send";
import { Add } from "./pages/Add";
import { FormSnippet } from "./pages/FormSnippet";
import { History } from "./pages/History";
import { NewList } from "./pages/NewList";

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
        <span className="spacer" />
        <span className="user">{me.username}</span>
        <button className="secondary" onClick={() => { void logout(); }}>Log out</button>
      </nav>
      <Routes>
        <Route path="/" element={<Lists />} />
        <Route path="/new-list" element={<NewList />} />
        <Route path="/list/:name" element={<ListDetail />} />
        <Route path="/list/:name/send" element={<Send />} />
        <Route path="/list/:name/add" element={<Add />} />
        <Route path="/list/:name/form" element={<FormSnippet />} />
        <Route path="/list/:name/history" element={<History />} />
        <Route path="*" element={<p>Not found.</p>} />
      </Routes>
    </div>
  );
}
