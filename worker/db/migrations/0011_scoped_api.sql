DROP TABLE IF EXISTS mcp_refresh_tokens;
DROP TABLE IF EXISTS mcp_tokens;
DROP TABLE IF EXISTS mcp_auth_sessions;
DROP TABLE IF EXISTS mcp_clients;
UPDATE settings SET settings = json_remove(settings, '$.ai_config') WHERE json_valid(settings);
CREATE TABLE api_keys (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 label TEXT NOT NULL, prefix TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER, last_used_at INTEGER
);
CREATE TABLE owner_revisions (owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE analysis_revisions (owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE api_mutation_context (
 owner_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, actor_kind TEXT NOT NULL,
 key_id TEXT, operation TEXT NOT NULL, token TEXT NOT NULL
);
CREATE TABLE api_idempotency (
 owner_id TEXT NOT NULL, key_id TEXT NOT NULL, value TEXT NOT NULL, fingerprint TEXT NOT NULL,
 response TEXT NOT NULL, status INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,key_id,value)
);
CREATE TABLE api_audit (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, actor_kind TEXT NOT NULL, key_id TEXT,
 request_id TEXT NOT NULL, operation TEXT NOT NULL, resource TEXT NOT NULL, resource_id TEXT NOT NULL,
 from_version INTEGER, to_version INTEGER, affected INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE INDEX api_audit_owner ON api_audit(owner_id,id);
CREATE TABLE account_classifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 account_name TEXT NOT NULL, type TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id,account_name)
);
CREATE TABLE balance_anchors (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 account_name TEXT NOT NULL, currency TEXT NOT NULL, date TEXT NOT NULL, balance_cents INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(user_id,account_name,currency,date)
);
CREATE TABLE financial_preferences (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 savings_rate_target REAL NOT NULL DEFAULT 30, expected_return_rate REAL NOT NULL DEFAULT 4,
 min_return_rate REAL NOT NULL DEFAULT 2, max_return_rate REAL NOT NULL DEFAULT 8,
 active_income_categories TEXT NOT NULL DEFAULT '[]', fixed_expense_categories TEXT NOT NULL DEFAULT '[]',
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE analyses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, markdown TEXT NOT NULL, external_id TEXT, period_start TEXT NOT NULL,
 period_end TEXT NOT NULL, currencies TEXT NOT NULL, data_revision INTEGER NOT NULL,
 author TEXT, model TEXT, evidence TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(user_id,external_id)
);
ALTER TABLE transactions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transactions ADD COLUMN updated_at INTEGER;
UPDATE transactions SET updated_at = created_at;
UPDATE transactions SET currency = CASE currency WHEN '人民币' THEN 'CNY' WHEN '美元' THEN 'USD' WHEN '港币' THEN 'HKD' ELSE currency END;
UPDATE transactions SET tags=json_extract(tags,'$') WHERE json_valid(tags) AND json_type(tags)='text' AND json_valid(json_extract(tags,'$')) AND json_type(json_extract(tags,'$'))='array';
CREATE TABLE tags_validation_transactions(valid INTEGER CHECK(valid=1));
INSERT INTO tags_validation_transactions SELECT 0 FROM transactions WHERE tags IS NULL OR NOT json_valid(tags) OR json_type(tags)!='array' LIMIT 1;
DROP TABLE tags_validation_transactions;
CREATE TABLE currency_validation_transactions(valid INTEGER CHECK(valid=1));
INSERT INTO currency_validation_transactions SELECT 0 FROM transactions WHERE currency IS NULL OR currency NOT IN ('CNY','USD','HKD') LIMIT 1;
DROP TABLE currency_validation_transactions;
CREATE TRIGGER scoped_transactions_insert AFTER INSERT ON transactions  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'transactions.insert'),
 'transactions',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_transactions_update AFTER UPDATE ON transactions WHEN NEW.version = OLD.version BEGIN
 UPDATE transactions SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'transactions.update'),
 'transactions',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_transactions_delete AFTER DELETE ON transactions  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'transactions.delete'),
 'transactions',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
ALTER TABLE transfers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transfers ADD COLUMN updated_at INTEGER;
UPDATE transfers SET updated_at = created_at;
UPDATE transfers SET currency = CASE currency WHEN '人民币' THEN 'CNY' WHEN '美元' THEN 'USD' WHEN '港币' THEN 'HKD' ELSE currency END;
UPDATE transfers SET tags=json_extract(tags,'$') WHERE json_valid(tags) AND json_type(tags)='text' AND json_valid(json_extract(tags,'$')) AND json_type(json_extract(tags,'$'))='array';
CREATE TABLE tags_validation_transfers(valid INTEGER CHECK(valid=1));
INSERT INTO tags_validation_transfers SELECT 0 FROM transfers WHERE tags IS NULL OR NOT json_valid(tags) OR json_type(tags)!='array' LIMIT 1;
DROP TABLE tags_validation_transfers;
CREATE TABLE currency_validation_transfers(valid INTEGER CHECK(valid=1));
INSERT INTO currency_validation_transfers SELECT 0 FROM transfers WHERE currency IS NULL OR currency NOT IN ('CNY','USD','HKD') LIMIT 1;
DROP TABLE currency_validation_transfers;
CREATE TRIGGER scoped_transfers_insert AFTER INSERT ON transfers  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'transfers.insert'),
 'transfers',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_transfers_update AFTER UPDATE ON transfers WHEN NEW.version = OLD.version BEGIN
 UPDATE transfers SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'transfers.update'),
 'transfers',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_transfers_delete AFTER DELETE ON transfers  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'transfers.delete'),
 'transfers',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
ALTER TABLE financial_products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
UPDATE financial_products SET currency = CASE currency WHEN '人民币' THEN 'CNY' WHEN '美元' THEN 'USD' WHEN '港币' THEN 'HKD' ELSE currency END;
CREATE TABLE currency_validation_financial_products(valid INTEGER CHECK(valid=1));
INSERT INTO currency_validation_financial_products SELECT 0 FROM financial_products WHERE currency IS NULL OR currency NOT IN ('CNY','USD','HKD') LIMIT 1;
DROP TABLE currency_validation_financial_products;
CREATE TRIGGER scoped_financial_products_insert AFTER INSERT ON financial_products  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'products.insert'),
 'products',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_financial_products_update AFTER UPDATE ON financial_products WHEN NEW.version = OLD.version BEGIN
 UPDATE financial_products SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'products.update'),
 'products',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_financial_products_delete AFTER DELETE ON financial_products  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'products.delete'),
 'products',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
ALTER TABLE capital_units ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
UPDATE capital_units SET currency = CASE currency WHEN '人民币' THEN 'CNY' WHEN '美元' THEN 'USD' WHEN '港币' THEN 'HKD' ELSE currency END;
CREATE TABLE currency_validation_capital_units(valid INTEGER CHECK(valid=1));
INSERT INTO currency_validation_capital_units SELECT 0 FROM capital_units WHERE currency IS NULL OR currency NOT IN ('CNY','USD','HKD') LIMIT 1;
DROP TABLE currency_validation_capital_units;
CREATE TRIGGER scoped_capital_units_insert AFTER INSERT ON capital_units  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'units.insert'),
 'units',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_capital_units_update AFTER UPDATE ON capital_units WHEN NEW.version = OLD.version BEGIN
 UPDATE capital_units SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'units.update'),
 'units',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_capital_units_delete AFTER DELETE ON capital_units  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'units.delete'),
 'units',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
ALTER TABLE contribution_logs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER scoped_contribution_logs_insert AFTER INSERT ON contribution_logs  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'contribution-logs.insert'),
 'contribution-logs',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_contribution_logs_update AFTER UPDATE ON contribution_logs WHEN NEW.version = OLD.version BEGIN
 UPDATE contribution_logs SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'contribution-logs.update'),
 'contribution-logs',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_contribution_logs_delete AFTER DELETE ON contribution_logs  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'contribution-logs.delete'),
 'contribution-logs',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
ALTER TABLE expense_categories ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER scoped_expense_categories_insert AFTER INSERT ON expense_categories  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'expense-categories.insert'),
 'expense-categories',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_expense_categories_update AFTER UPDATE ON expense_categories WHEN NEW.version = OLD.version BEGIN
 UPDATE expense_categories SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'expense-categories.update'),
 'expense-categories',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_expense_categories_delete AFTER DELETE ON expense_categories  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'expense-categories.delete'),
 'expense-categories',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
ALTER TABLE recurring_expenses ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
UPDATE recurring_expenses SET currency = CASE currency WHEN '人民币' THEN 'CNY' WHEN '美元' THEN 'USD' WHEN '港币' THEN 'HKD' ELSE currency END;
CREATE TABLE currency_validation_recurring_expenses(valid INTEGER CHECK(valid=1));
INSERT INTO currency_validation_recurring_expenses SELECT 0 FROM recurring_expenses WHERE currency IS NULL OR currency NOT IN ('CNY','USD','HKD') LIMIT 1;
DROP TABLE currency_validation_recurring_expenses;
CREATE TRIGGER scoped_recurring_expenses_insert AFTER INSERT ON recurring_expenses  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'recurring-expenses.insert'),
 'recurring-expenses',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_recurring_expenses_update AFTER UPDATE ON recurring_expenses WHEN NEW.version = OLD.version BEGIN
 UPDATE recurring_expenses SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'recurring-expenses.update'),
 'recurring-expenses',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_recurring_expenses_delete AFTER DELETE ON recurring_expenses  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'recurring-expenses.delete'),
 'recurring-expenses',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
CREATE TRIGGER scoped_account_classifications_insert AFTER INSERT ON account_classifications  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'account-classifications.insert'),
 'account-classifications',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_account_classifications_update AFTER UPDATE ON account_classifications WHEN NEW.version = OLD.version BEGIN
 UPDATE account_classifications SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'account-classifications.update'),
 'account-classifications',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_account_classifications_delete AFTER DELETE ON account_classifications  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'account-classifications.delete'),
 'account-classifications',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
UPDATE balance_anchors SET currency = CASE currency WHEN '人民币' THEN 'CNY' WHEN '美元' THEN 'USD' WHEN '港币' THEN 'HKD' ELSE currency END;
CREATE TABLE currency_validation_balance_anchors(valid INTEGER CHECK(valid=1));
INSERT INTO currency_validation_balance_anchors SELECT 0 FROM balance_anchors WHERE currency IS NULL OR currency NOT IN ('CNY','USD','HKD') LIMIT 1;
DROP TABLE currency_validation_balance_anchors;
CREATE TRIGGER scoped_balance_anchors_insert AFTER INSERT ON balance_anchors  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'balance-anchors.insert'),
 'balance-anchors',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_balance_anchors_update AFTER UPDATE ON balance_anchors WHEN NEW.version = OLD.version BEGIN
 UPDATE balance_anchors SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'balance-anchors.update'),
 'balance-anchors',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_balance_anchors_delete AFTER DELETE ON balance_anchors  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'balance-anchors.delete'),
 'balance-anchors',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
CREATE TRIGGER scoped_financial_preferences_insert AFTER INSERT ON financial_preferences  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'financial-preferences.insert'),
 'financial-preferences',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_financial_preferences_update AFTER UPDATE ON financial_preferences WHEN NEW.version = OLD.version BEGIN
 UPDATE financial_preferences SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO owner_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'financial-preferences.update'),
 'financial-preferences',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_financial_preferences_delete AFTER DELETE ON financial_preferences  BEGIN

 INSERT INTO owner_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'financial-preferences.delete'),
 'financial-preferences',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
CREATE TRIGGER scoped_analyses_insert AFTER INSERT ON analyses  BEGIN

 INSERT INTO analysis_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'analyses.insert'),
 'analyses',NEW.id,NULL,NEW.version,unixepoch()*1000);
END;
CREATE TRIGGER scoped_analyses_update AFTER UPDATE ON analyses WHEN NEW.version = OLD.version BEGIN
 UPDATE analyses SET version=OLD.version+1 WHERE id=NEW.id;
 INSERT INTO analysis_revisions(owner_id,revision) VALUES(NEW.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=NEW.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=NEW.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=NEW.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=NEW.user_id),'analyses.update'),
 'analyses',NEW.id,OLD.version,OLD.version+1,unixepoch()*1000);
END;
CREATE TRIGGER scoped_analyses_delete AFTER DELETE ON analyses  BEGIN

 INSERT INTO analysis_revisions(owner_id,revision) VALUES(OLD.user_id,1) ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
 INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,created_at)
 VALUES(lower(hex(randomblob(16))),OLD.user_id,
 coalesce((SELECT actor_kind FROM api_mutation_context WHERE owner_id=OLD.user_id),'human'),
 (SELECT key_id FROM api_mutation_context WHERE owner_id=OLD.user_id),
 coalesce((SELECT request_id FROM api_mutation_context WHERE owner_id=OLD.user_id),lower(hex(randomblob(16)))),
 coalesce((SELECT operation FROM api_mutation_context WHERE owner_id=OLD.user_id),'analyses.delete'),
 'analyses',OLD.id,OLD.version,NULL,unixepoch()*1000);
END;
CREATE TABLE scoped_settings_validation(valid INTEGER NOT NULL CHECK(valid=1));
INSERT INTO scoped_settings_validation SELECT 0 FROM settings WHERE NOT json_valid(settings) LIMIT 1;
INSERT INTO scoped_settings_validation
SELECT 0 FROM settings WHERE
 (json_type(settings,'$.savings_rate_target') IS NOT NULL AND json_type(settings,'$.savings_rate_target') NOT IN ('integer','real')) OR
 (json_type(settings,'$.expected_return_rate') IS NOT NULL AND json_type(settings,'$.expected_return_rate') NOT IN ('integer','real')) OR
 (json_type(settings,'$.min_return_rate') IS NOT NULL AND json_type(settings,'$.min_return_rate') NOT IN ('integer','real')) OR
 (json_type(settings,'$.max_return_rate') IS NOT NULL AND json_type(settings,'$.max_return_rate') NOT IN ('integer','real')) OR
 (json_type(settings,'$.account_types') IS NOT NULL AND json_type(settings,'$.account_types')!='array') OR
 (json_type(settings,'$.balance_anchors') IS NOT NULL AND json_type(settings,'$.balance_anchors')!='array') OR
 (json_type(settings,'$.active_income_categories') IS NOT NULL AND json_type(settings,'$.active_income_categories')!='array') OR
 (json_type(settings,'$.fixed_expense_categories') IS NOT NULL AND json_type(settings,'$.fixed_expense_categories')!='array') OR
 coalesce(json_extract(settings,'$.savings_rate_target'),30) NOT BETWEEN 0 AND 100 OR
 coalesce(json_extract(settings,'$.expected_return_rate'),4) NOT BETWEEN -100 AND 100 OR
 coalesce(json_extract(settings,'$.min_return_rate'),2) NOT BETWEEN -100 AND 100 OR
 coalesce(json_extract(settings,'$.max_return_rate'),8) NOT BETWEEN -100 AND 100 OR
 coalesce(json_extract(settings,'$.min_return_rate'),2)>coalesce(json_extract(settings,'$.max_return_rate'),8)
LIMIT 1;
INSERT INTO scoped_settings_validation
SELECT 0 FROM settings s,json_each(s.settings,'$.account_types') a WHERE
 json_type(a.value,'$.accountName')!='text' OR trim(json_extract(a.value,'$.accountName'))='' OR
 json_extract(a.value,'$.type') NOT IN ('debit','credit','prepaid','financial','unclassified') OR
 json_type(a.value,'$.accountName') IS NULL OR json_type(a.value,'$.type') IS NULL LIMIT 1;
INSERT INTO account_classifications(id,user_id,account_name,type,created_at,updated_at)
SELECT lower(hex(randomblob(16))),s.owner_id,json_extract(a.value,'$.accountName'),json_extract(a.value,'$.type'),unixepoch()*1000,unixepoch()*1000
FROM settings s,json_each(s.settings,'$.account_types') a;
INSERT INTO scoped_settings_validation
SELECT 0 FROM settings s,json_each(s.settings,'$.balance_anchors') a WHERE
 coalesce(json_type(a.value,'$.accountName'),'null')!='text' OR trim(json_extract(a.value,'$.accountName'))='' OR
 coalesce(json_type(a.value,'$.date'),'null')!='text' OR
 coalesce(date(json_extract(a.value,'$.date'),'+0 days'),'')!=json_extract(a.value,'$.date') OR
 length(json_extract(a.value,'$.date'))!=10 OR
 coalesce(json_type(a.value,'$.balance'),'null') NOT IN ('integer','real') OR
 abs(json_extract(a.value,'$.balance')*100)>9007199254740991 OR
 abs(json_extract(a.value,'$.balance')*100-round(json_extract(a.value,'$.balance')*100))>0.000001 OR
 (SELECT count(DISTINCT currency) FROM (
   SELECT currency FROM transactions WHERE user_id=s.owner_id AND account=json_extract(a.value,'$.accountName')
   UNION SELECT currency FROM transfers WHERE user_id=s.owner_id AND account=json_extract(a.value,'$.accountName')
 ))!=1 LIMIT 1;
INSERT INTO balance_anchors(id,user_id,account_name,currency,date,balance_cents,created_at,updated_at)
SELECT lower(hex(randomblob(16))),s.owner_id,json_extract(a.value,'$.accountName'),
 (SELECT currency FROM (
   SELECT currency FROM transactions WHERE user_id=s.owner_id AND account=json_extract(a.value,'$.accountName')
   UNION SELECT currency FROM transfers WHERE user_id=s.owner_id AND account=json_extract(a.value,'$.accountName')
 ) LIMIT 1),json_extract(a.value,'$.date'),cast(round(json_extract(a.value,'$.balance')*100) AS INTEGER),unixepoch()*1000,unixepoch()*1000
FROM settings s,json_each(s.settings,'$.balance_anchors') a;
INSERT INTO scoped_settings_validation
SELECT 0 FROM settings s,json_each(s.settings,'$.active_income_categories') a WHERE a.type!='text' OR length(trim(a.value))=0 LIMIT 1;
INSERT INTO scoped_settings_validation
SELECT 0 FROM settings s,json_each(s.settings,'$.fixed_expense_categories') a WHERE a.type!='text' OR length(trim(a.value))=0 LIMIT 1;
INSERT INTO financial_preferences(id,user_id,savings_rate_target,expected_return_rate,min_return_rate,max_return_rate,active_income_categories,fixed_expense_categories,created_at,updated_at)
SELECT owner_id,owner_id,coalesce(json_extract(settings,'$.savings_rate_target'),30),
 coalesce(json_extract(settings,'$.expected_return_rate'),4),coalesce(json_extract(settings,'$.min_return_rate'),2),
 coalesce(json_extract(settings,'$.max_return_rate'),8),coalesce(json_extract(settings,'$.active_income_categories'),'[]'),
 coalesce(json_extract(settings,'$.fixed_expense_categories'),'[]'),unixepoch()*1000,unixepoch()*1000 FROM settings;
UPDATE settings SET settings=json_remove(settings,'$.ai_config','$.account_types','$.balance_anchors','$.savings_rate_target','$.expected_return_rate','$.min_return_rate','$.max_return_rate','$.active_income_categories','$.fixed_expense_categories');
DROP TABLE scoped_settings_validation;
CREATE TABLE analysis_creation_receipts (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 external_id TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL,
 created_at INTEGER NOT NULL, PRIMARY KEY(owner_id,external_id)
);
