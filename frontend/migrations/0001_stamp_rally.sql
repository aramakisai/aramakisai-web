CREATE TABLE stamps (
  visitor_id    TEXT    NOT NULL,
  exhibition_id INTEGER NOT NULL,
  category      TEXT    NOT NULL CHECK (category IN ('exhibit', 'vendor', 'other')),
  acquired_at   TEXT    NOT NULL,
  PRIMARY KEY (visitor_id, exhibition_id, category)
) WITHOUT ROWID;

CREATE TABLE exchanges (
  exchange_id  INTEGER PRIMARY KEY,
  visitor_id   TEXT NOT NULL,
  exchanged_at TEXT NOT NULL,
  exchanged_by TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT
);

CREATE UNIQUE INDEX exchanges_active_visitor
  ON exchanges (visitor_id) WHERE cancelled_at IS NULL;
