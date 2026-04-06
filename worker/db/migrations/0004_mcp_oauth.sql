-- MCP OAuth 2.1 Tables
-- Migration: 0004_mcp_oauth.sql

-- MCP OAuth 客户端 (动态注册)
CREATE TABLE mcp_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT,
  client_name TEXT NOT NULL,
  client_uri TEXT,
  logo_uri TEXT,
  redirect_uris TEXT NOT NULL,
  grant_types TEXT NOT NULL,
  response_types TEXT NOT NULL,
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  scope TEXT NOT NULL DEFAULT 'noheir:read noheir:write',
  contacts TEXT,
  tos_uri TEXT,
  policy_uri TEXT,
  software_id TEXT,
  software_version TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_mcp_clients_client_id ON mcp_clients(client_id);

-- MCP 授权会话 (authorize → callback 中间状态)
CREATE TABLE mcp_auth_sessions (
  id TEXT PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope TEXT NOT NULL,
  nonce TEXT,
  code TEXT,
  user_id TEXT,
  expires_at INTEGER NOT NULL,
  consumed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (client_id) REFERENCES mcp_clients(client_id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_auth_sessions_state ON mcp_auth_sessions(state);
CREATE INDEX idx_mcp_auth_sessions_code ON mcp_auth_sessions(code);
CREATE INDEX idx_mcp_auth_sessions_expires ON mcp_auth_sessions(expires_at);

-- MCP Access Tokens
CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT UNIQUE NOT NULL,
  access_token_preview TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  client_name TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,
  last_used_at TEXT,
  last_used_ip TEXT,

  FOREIGN KEY (client_id) REFERENCES mcp_clients(client_id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_tokens_hash ON mcp_tokens(access_token_hash);
CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_id);
CREATE INDEX idx_mcp_tokens_expires ON mcp_tokens(expires_at);

-- MCP Refresh Tokens (支持 rotation)
CREATE TABLE mcp_refresh_tokens (
  id TEXT PRIMARY KEY,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  access_token_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  rotated_at TEXT,
  rotated_to TEXT,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,

  FOREIGN KEY (client_id) REFERENCES mcp_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (access_token_id) REFERENCES mcp_tokens(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_refresh_tokens_hash ON mcp_refresh_tokens(refresh_token_hash);
CREATE INDEX idx_mcp_refresh_tokens_user ON mcp_refresh_tokens(user_id);
CREATE INDEX idx_mcp_refresh_tokens_expires ON mcp_refresh_tokens(expires_at);
CREATE INDEX idx_mcp_refresh_tokens_access ON mcp_refresh_tokens(access_token_id);
