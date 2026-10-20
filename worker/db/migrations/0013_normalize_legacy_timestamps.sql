-- Normalize Gen2 MCP ISO-text (and related text) timestamps on financial rows to
-- integer encodings used elsewhere in the app.
--
-- financial_products / capital_units: Unix seconds (matches prepareFinancialData).
-- contribution_logs: seconds below 1e12, milliseconds at/above 1e12 (see contribution-log-time).
--
-- Scoped UPDATE triggers bump version, owner_revisions and api_audit whenever
-- NEW.version = OLD.version. Drop those UPDATE triggers for the tables touched
-- here, rewrite only parseable text columns, then recreate the triggers from
-- 0011 unchanged. Row version and If-Match ETags stay the same; no audit rows
-- are written for this data repair. Re-applying is a no-op: only typeof='text'
-- cells are candidates and successful writes become integers.

DROP TRIGGER IF EXISTS scoped_financial_products_update;
DROP TRIGGER IF EXISTS scoped_capital_units_update;
DROP TRIGGER IF EXISTS scoped_contribution_logs_update;

UPDATE financial_products
SET
  created_at = CASE
    WHEN typeof(created_at) = 'text' AND trim(created_at) != '' AND created_at GLOB '[0-9]*' AND created_at NOT GLOB '*[^0-9]*' AND CAST(created_at AS INTEGER) > 0 THEN
      CASE
        WHEN length(created_at) >= 13 OR CAST(created_at AS INTEGER) >= 1000000000000 THEN CAST(CAST(created_at AS INTEGER) / 1000 AS INTEGER)
        ELSE CAST(created_at AS INTEGER)
      END
    WHEN typeof(created_at) = 'text' AND trim(created_at) != '' AND created_at LIKE '____-__-__%' AND unixepoch(created_at) IS NOT NULL THEN unixepoch(created_at)
    ELSE created_at
  END,
  updated_at = CASE
    WHEN typeof(updated_at) = 'text' AND trim(updated_at) != '' AND updated_at GLOB '[0-9]*' AND updated_at NOT GLOB '*[^0-9]*' AND CAST(updated_at AS INTEGER) > 0 THEN
      CASE
        WHEN length(updated_at) >= 13 OR CAST(updated_at AS INTEGER) >= 1000000000000 THEN CAST(CAST(updated_at AS INTEGER) / 1000 AS INTEGER)
        ELSE CAST(updated_at AS INTEGER)
      END
    WHEN typeof(updated_at) = 'text' AND trim(updated_at) != '' AND updated_at LIKE '____-__-__%' AND unixepoch(updated_at) IS NOT NULL THEN unixepoch(updated_at)
    ELSE updated_at
  END
WHERE typeof(created_at) = 'text' OR typeof(updated_at) = 'text';

UPDATE capital_units
SET
  created_at = CASE
    WHEN typeof(created_at) = 'text' AND trim(created_at) != '' AND created_at GLOB '[0-9]*' AND created_at NOT GLOB '*[^0-9]*' AND CAST(created_at AS INTEGER) > 0 THEN
      CASE
        WHEN length(created_at) >= 13 OR CAST(created_at AS INTEGER) >= 1000000000000 THEN CAST(CAST(created_at AS INTEGER) / 1000 AS INTEGER)
        ELSE CAST(created_at AS INTEGER)
      END
    WHEN typeof(created_at) = 'text' AND trim(created_at) != '' AND created_at LIKE '____-__-__%' AND unixepoch(created_at) IS NOT NULL THEN unixepoch(created_at)
    ELSE created_at
  END,
  updated_at = CASE
    WHEN typeof(updated_at) = 'text' AND trim(updated_at) != '' AND updated_at GLOB '[0-9]*' AND updated_at NOT GLOB '*[^0-9]*' AND CAST(updated_at AS INTEGER) > 0 THEN
      CASE
        WHEN length(updated_at) >= 13 OR CAST(updated_at AS INTEGER) >= 1000000000000 THEN CAST(CAST(updated_at AS INTEGER) / 1000 AS INTEGER)
        ELSE CAST(updated_at AS INTEGER)
      END
    WHEN typeof(updated_at) = 'text' AND trim(updated_at) != '' AND updated_at LIKE '____-__-__%' AND unixepoch(updated_at) IS NOT NULL THEN unixepoch(updated_at)
    ELSE updated_at
  END
WHERE typeof(created_at) = 'text' OR typeof(updated_at) = 'text';

UPDATE contribution_logs
SET
  created_at = CASE
    WHEN typeof(created_at) = 'text' AND trim(created_at) != '' AND created_at GLOB '[0-9]*' AND created_at NOT GLOB '*[^0-9]*' AND CAST(created_at AS INTEGER) > 0 THEN CAST(created_at AS INTEGER)
    WHEN typeof(created_at) = 'text' AND trim(created_at) != '' AND created_at LIKE '____-__-__%' AND unixepoch(created_at) IS NOT NULL THEN unixepoch(created_at)
    ELSE created_at
  END,
  updated_at = CASE
    WHEN typeof(updated_at) = 'text' AND trim(updated_at) != '' AND updated_at GLOB '[0-9]*' AND updated_at NOT GLOB '*[^0-9]*' AND CAST(updated_at AS INTEGER) > 0 THEN CAST(updated_at AS INTEGER)
    WHEN typeof(updated_at) = 'text' AND trim(updated_at) != '' AND updated_at LIKE '____-__-__%' AND unixepoch(updated_at) IS NOT NULL THEN unixepoch(updated_at)
    ELSE updated_at
  END,
  deleted_at = CASE
    WHEN typeof(deleted_at) = 'text' AND trim(deleted_at) = '' THEN NULL
    WHEN typeof(deleted_at) = 'text' AND deleted_at GLOB '[0-9]*' AND deleted_at NOT GLOB '*[^0-9]*' AND CAST(deleted_at AS INTEGER) > 0 THEN CAST(deleted_at AS INTEGER)
    WHEN typeof(deleted_at) = 'text' AND deleted_at LIKE '____-__-__%' AND unixepoch(deleted_at) IS NOT NULL THEN unixepoch(deleted_at)
    ELSE deleted_at
  END
WHERE typeof(created_at) = 'text' OR typeof(updated_at) = 'text' OR typeof(deleted_at) = 'text';

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
