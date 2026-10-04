CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  form_type TEXT NOT NULL,
  route TEXT NOT NULL,
  property_reference TEXT,
  first_name TEXT,
  last_name TEXT,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  property_type TEXT,
  bedrooms TEXT,
  location TEXT,
  client_type TEXT,
  consent INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0, 1)),
  fields_json TEXT NOT NULL,
  claim_token TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sending', 'accepted', 'failed')),
  provider_id TEXT,
  safe_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS leads_delivery_status_idx ON leads (delivery_status);
CREATE INDEX IF NOT EXISTS leads_form_type_created_at_idx ON leads (form_type, created_at);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at);
