CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  list TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  confirmed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(email, list)
);

CREATE TABLE sent_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  post_link TEXT,
  recipient_count INTEGER NOT NULL,
  sent_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sent_notifications_list_created
  ON sent_notifications(list, created_at DESC);
