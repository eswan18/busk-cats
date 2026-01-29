CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  list TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  confirmed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(email, list)
);
