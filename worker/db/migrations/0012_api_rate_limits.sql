CREATE TABLE api_rate_limits (
  subject TEXT NOT NULL,
  budget TEXT NOT NULL CHECK (budget IN ('requests', 'expensive')),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (subject, budget, window_start)
);
CREATE INDEX api_rate_limits_expiry ON api_rate_limits(window_start);
