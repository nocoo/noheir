-- ============================================================================
-- Squashed Migration: Full Schema
-- Date: 2026-02-10
-- Description: Consolidated from 11 incremental migrations into a single file.
--   Includes all tables, indexes, RPC functions, RLS policies, and grants.
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================================
-- TABLE: financial_products (理财产品)
-- Must be created before capital_units due to FK reference
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."financial_products" (
  "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
  "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
  "name" "text" NOT NULL,
  "code" "text",
  "channel" "text",
  "category" "text",
  "currency" "text" DEFAULT 'CNY'::"text",
  "lock_period_days" integer DEFAULT 0,
  "annual_return_rate" numeric(5,2),
  "created_at" timestamp with time zone DEFAULT "now"(),
  CONSTRAINT "financial_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_products_category_check" CHECK (
    "category" = ANY (ARRAY['养老年金'::"text", '储蓄保险'::"text", '混债基金'::"text", '债券基金'::"text", '货币基金'::"text", '股票基金'::"text", '指数基金'::"text", '宽基指数'::"text", '私募基金'::"text", '定期存款'::"text", '理财产品'::"text", '现金+'::"text"])
  ),
  CONSTRAINT "financial_products_channel_check" CHECK (
    "channel" = ANY (ARRAY['招商银行'::"text", '平安银行'::"text", '微众银行'::"text", '支付宝'::"text", '招银香港'::"text", '光大永明'::"text", '中信建投'::"text"])
  ),
  CONSTRAINT "financial_products_currency_check" CHECK (
    "currency" = ANY (ARRAY['CNY'::"text", 'USD'::"text", 'HKD'::"text"])
  )
);

ALTER TABLE "public"."financial_products"
  ADD CONSTRAINT "financial_products_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_financial_products_user" ON "public"."financial_products" USING "btree" ("user_id");


-- ============================================================================
-- TABLE: capital_units (资金单元)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."capital_units" (
  "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
  "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
  "unit_code" "text" NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "currency" "text" DEFAULT 'CNY'::"text",
  "status" "text" DEFAULT '已成立'::"text",
  "strategy" "text",
  "tactics" "text",
  "product_id" "uuid",
  "start_date" "date",
  "end_date" "date",
  "note" "text",
  "created_at" timestamp with time zone DEFAULT "now"(),
  CONSTRAINT "capital_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "capital_units_status_check" CHECK (
    "status" = ANY (ARRAY['已成立'::"text", '计划中'::"text", '筹集中'::"text", '已归档'::"text"])
  ),
  CONSTRAINT "capital_units_strategy_check" CHECK (
    "strategy" = ANY (ARRAY['远期理财'::"text", '美元资产'::"text", '36存单'::"text", '长期理财'::"text", '短期理财'::"text", '中期理财'::"text", '进攻计划'::"text", '麻麻理财'::"text"])
  ),
  CONSTRAINT "capital_units_tactics_check" CHECK (
    "tactics" = ANY (ARRAY['养老年金'::"text", '个人养老金'::"text", '定期存款'::"text", '理财产品'::"text", '现金产品'::"text", '债券基金'::"text", '偏股基金'::"text", '稳健理财'::"text", '增额寿险'::"text", '货币基金'::"text"])
  )
);

ALTER TABLE "public"."capital_units"
  ADD CONSTRAINT "capital_units_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."capital_units"
  ADD CONSTRAINT "capital_units_product_id_fkey" FOREIGN KEY ("product_id")
  REFERENCES "public"."financial_products"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_capital_units_user" ON "public"."capital_units" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_capital_units_product" ON "public"."capital_units" USING "btree" ("product_id");


-- ============================================================================
-- TABLE: transactions (交易记录)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."transactions" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
  "date" "text" NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "day" integer NOT NULL,
  "primary_category" "text" NOT NULL,
  "secondary_category" "text",
  "tertiary_category" "text" NOT NULL,
  "amount" numeric NOT NULL,
  "type" "text" NOT NULL,
  "account" "text" NOT NULL,
  "currency" "text" DEFAULT '人民币'::"text" NOT NULL,
  "tags" "text"[] DEFAULT '{}'::"text"[],
  "note" "text",
  "raw_index" integer,
  "has_secondary_mapping" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT "now"(),
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "check_type" CHECK (
    "type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text"])
  )
);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_transactions_user_year" ON "public"."transactions" USING "btree" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "public"."transactions" USING "btree" ("date");
CREATE INDEX IF NOT EXISTS "idx_transactions_type" ON "public"."transactions" USING "btree" ("type");
CREATE INDEX IF NOT EXISTS "idx_transactions_primary_category" ON "public"."transactions" USING "btree" ("primary_category");
CREATE INDEX IF NOT EXISTS "idx_transactions_tags" ON "public"."transactions" USING "gin" ("tags");
CREATE INDEX IF NOT EXISTS "idx_transactions_note_trgm" ON "public"."transactions" USING "gin" ("note" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_transactions_account" ON "public"."transactions" USING "btree" ("account");
CREATE INDEX IF NOT EXISTS "idx_transactions_user_type_date" ON "public"."transactions" USING "btree" ("user_id", "type", "date" DESC);


-- ============================================================================
-- TABLE: transfers (转账记录)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."transfers" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
  "date" "text" NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "day" integer NOT NULL,
  "primary_category" "text",
  "secondary_category" "text" DEFAULT '转账'::"text",
  "transaction_type" "text",
  "inflow_amount" numeric DEFAULT 0,
  "outflow_amount" numeric DEFAULT 0,
  "currency" "text" DEFAULT '人民币'::"text" NOT NULL,
  "account" "text" NOT NULL,
  "tags" "text"[] DEFAULT '{}'::"text"[],
  "note" "text",
  "raw_index" integer,
  "created_at" timestamp with time zone DEFAULT "now"(),
  CONSTRAINT "transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transfers_currency_check" CHECK (
    "currency" = ANY (ARRAY['人民币'::"text", '港币'::"text", '美元'::"text"])
  )
);

ALTER TABLE "public"."transfers"
  ADD CONSTRAINT "transfers_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_transfers_user_year" ON "public"."transfers" USING "btree" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "idx_transfers_date" ON "public"."transfers" USING "btree" ("date");
CREATE INDEX IF NOT EXISTS "idx_transfers_account" ON "public"."transfers" USING "btree" ("account");
CREATE INDEX IF NOT EXISTS "idx_transfers_primary_category" ON "public"."transfers" USING "btree" ("primary_category");
CREATE INDEX IF NOT EXISTS "idx_transfers_tags" ON "public"."transfers" USING "gin" ("tags");
CREATE INDEX IF NOT EXISTS "idx_transfers_note_trgm" ON "public"."transfers" USING "gin" ("note" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_transfers_user_date" ON "public"."transfers" USING "btree" ("user_id", "date" DESC);


-- ============================================================================
-- TABLE: settings (用户设置)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."settings" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "owner_id" "uuid",
  "site_name" "text" DEFAULT ''::"text",
  "settings" "jsonb" DEFAULT '{}'::"jsonb",
  CONSTRAINT "site_metadata_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."settings"
  ADD CONSTRAINT "site_metadata_owner_id_fkey" FOREIGN KEY ("owner_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- financial_products
ALTER TABLE "public"."financial_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."financial_products" FORCE ROW LEVEL SECURITY;

CREATE POLICY "products_select_policy" ON "public"."financial_products"
  FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "products_insert_policy" ON "public"."financial_products"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "products_update_policy" ON "public"."financial_products"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "products_delete_policy" ON "public"."financial_products"
  FOR DELETE USING (("auth"."uid"() = "user_id"));

-- capital_units
ALTER TABLE "public"."capital_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."capital_units" FORCE ROW LEVEL SECURITY;

CREATE POLICY "units_select_policy" ON "public"."capital_units"
  FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "units_insert_policy" ON "public"."capital_units"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "units_update_policy" ON "public"."capital_units"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "units_delete_policy" ON "public"."capital_units"
  FOR DELETE USING (("auth"."uid"() = "user_id"));

-- transactions
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON "public"."transactions"
  FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert own transactions" ON "public"."transactions"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own transactions" ON "public"."transactions"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete own transactions" ON "public"."transactions"
  FOR DELETE USING (("auth"."uid"() = "user_id"));

-- transfers
ALTER TABLE "public"."transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transfers" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfers" ON "public"."transfers"
  FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert own transfers" ON "public"."transfers"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own transfers" ON "public"."transfers"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete own transfers" ON "public"."transfers"
  FOR DELETE USING (("auth"."uid"() = "user_id"));

-- settings
ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON "public"."settings"
  FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));
CREATE POLICY "Users can insert own data" ON "public"."settings"
  FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));
CREATE POLICY "Users can update own data" ON "public"."settings"
  FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));
CREATE POLICY "Users can delete own data" ON "public"."settings"
  FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));


-- ============================================================================
-- CLEANUP: Drop old function signatures to avoid ambiguity
-- Required when applying on top of existing databases with prior migrations
-- ============================================================================
DROP FUNCTION IF EXISTS "public"."get_units_with_products"() CASCADE;
DROP FUNCTION IF EXISTS "public"."search_transactions_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS "public"."search_transactions_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS "public"."search_transactions_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT[], TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS "public"."search_transfers_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS "public"."get_financial_metadata"() CASCADE;
DROP FUNCTION IF EXISTS "public"."get_monthly_report"(INTEGER, INTEGER, TEXT) CASCADE;


-- ============================================================================
-- FUNCTION: get_units_with_products
-- Joins capital_units with financial_products for the current user
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_units_with_products"()
RETURNS TABLE(
  "id" "uuid",
  "user_id" "uuid",
  "unit_code" "text",
  "amount" numeric,
  "currency" "text",
  "status" "text",
  "strategy" "text",
  "tactics" "text",
  "product_id" "uuid",
  "start_date" "date",
  "end_date" "date",
  "note" "text",
  "created_at" timestamp with time zone,
  "product" "jsonb"
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.user_id,
    u.unit_code,
    u.amount,
    u.currency,
    u.status,
    u.strategy,
    u.tactics,
    u.product_id,
    u.start_date,
    u.end_date,
    u.note,
    u.created_at,
    to_jsonb(p) AS product
  FROM capital_units u
  LEFT JOIN financial_products p ON u.product_id = p.id
  WHERE u.user_id = auth.uid()
  ORDER BY u.created_at DESC;
END;
$$;


-- ============================================================================
-- FUNCTION: search_transactions_fuzzy
-- Fuzzy search transactions with keyword, filters, and sub-category support
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."search_transactions_fuzzy"(
  p_keyword              TEXT     DEFAULT NULL,
  p_categories           TEXT[]   DEFAULT NULL,
  p_type                 TEXT     DEFAULT NULL,
  p_accounts             TEXT[]   DEFAULT NULL,
  p_tags                 TEXT[]   DEFAULT NULL,
  p_start_date           TEXT     DEFAULT NULL,
  p_end_date             TEXT     DEFAULT NULL,
  p_min_amount           NUMERIC  DEFAULT NULL,
  p_max_amount           NUMERIC  DEFAULT NULL,
  p_limit                INTEGER  DEFAULT 50,
  p_offset               INTEGER  DEFAULT 0,
  p_year                 INTEGER  DEFAULT NULL,
  p_month                INTEGER  DEFAULT NULL,
  p_currency             TEXT     DEFAULT NULL,
  p_secondary_categories TEXT[]   DEFAULT NULL,
  p_tertiary_categories  TEXT[]   DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  date                TEXT,
  year                INTEGER,
  month               INTEGER,
  day                 INTEGER,
  primary_category    TEXT,
  secondary_category  TEXT,
  tertiary_category   TEXT,
  amount              NUMERIC,
  type                TEXT,
  account             TEXT,
  currency            TEXT,
  tags                TEXT[],
  note                TEXT,
  matched_field       TEXT
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  v_limit := LEAST(GREATEST(p_limit, 1), 500);

  RETURN QUERY
  SELECT
    t.id,
    t.date,
    t.year,
    t.month,
    t.day,
    t.primary_category,
    t.secondary_category,
    t.tertiary_category,
    t.amount,
    t.type,
    t.account,
    t.currency,
    t.tags,
    t.note,
    CASE
      WHEN p_keyword IS NOT NULL AND t.note ILIKE '%' || p_keyword || '%' THEN 'note'
      WHEN p_keyword IS NOT NULL AND t.primary_category ILIKE '%' || p_keyword || '%' THEN 'category'
      WHEN p_keyword IS NOT NULL AND t.secondary_category ILIKE '%' || p_keyword || '%' THEN 'secondary_category'
      WHEN p_keyword IS NOT NULL AND t.tertiary_category ILIKE '%' || p_keyword || '%' THEN 'tertiary_category'
      WHEN p_keyword IS NOT NULL AND t.account ILIKE '%' || p_keyword || '%' THEN 'account'
      ELSE NULL
    END AS matched_field
  FROM "transactions" t
  WHERE t.user_id = auth.uid()
    AND (p_keyword IS NULL
      OR t.note ILIKE '%' || p_keyword || '%'
      OR t.primary_category ILIKE '%' || p_keyword || '%'
      OR t.secondary_category ILIKE '%' || p_keyword || '%'
      OR t.tertiary_category ILIKE '%' || p_keyword || '%'
      OR t.account ILIKE '%' || p_keyword || '%'
    )
    AND (p_categories IS NULL OR t.primary_category = ANY(p_categories))
    AND (p_secondary_categories IS NULL OR t.secondary_category = ANY(p_secondary_categories))
    AND (p_tertiary_categories IS NULL OR t.tertiary_category = ANY(p_tertiary_categories))
    AND (p_type IS NULL OR t.type = p_type)
    AND (p_accounts IS NULL OR t.account = ANY(p_accounts))
    AND (p_tags IS NULL OR t.tags && p_tags)
    AND (p_start_date IS NULL OR t.date >= p_start_date)
    AND (p_end_date IS NULL OR t.date <= p_end_date)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (p_year IS NULL OR t.year = p_year)
    AND (p_month IS NULL OR t.month = p_month)
    AND (p_currency IS NULL OR t.currency = p_currency)
  ORDER BY t.date DESC, t.created_at DESC
  LIMIT v_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION "public"."search_transactions_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT[], TEXT[]) IS
'Fuzzy search transactions with filters including year, month, currency, and sub-category arrays. matched_field reports which field matched the keyword. Enforces user isolation via auth.uid(). Results limited to 500 max per query.';


-- ============================================================================
-- FUNCTION: search_transfers_fuzzy
-- Fuzzy search transfers with keyword, filters, year/month/currency support
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."search_transfers_fuzzy"(
  p_keyword TEXT DEFAULT NULL,
  p_accounts TEXT[] DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  date TEXT,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  primary_category TEXT,
  secondary_category TEXT,
  transaction_type TEXT,
  inflow_amount NUMERIC,
  outflow_amount NUMERIC,
  account TEXT,
  currency TEXT,
  tags TEXT[],
  note TEXT,
  matched_field TEXT
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  v_limit := LEAST(GREATEST(p_limit, 1), 500);

  RETURN QUERY
  SELECT
    t.id,
    t.date,
    t.year,
    t.month,
    t.day,
    t.primary_category,
    t.secondary_category,
    t.transaction_type,
    t.inflow_amount,
    t.outflow_amount,
    t.account,
    t.currency,
    t.tags,
    t.note,
    CASE
      WHEN p_keyword IS NOT NULL AND t.note ILIKE '%' || p_keyword || '%' THEN 'note'
      WHEN p_keyword IS NOT NULL AND t.primary_category ILIKE '%' || p_keyword || '%' THEN 'category'
      WHEN p_keyword IS NOT NULL AND t.account ILIKE '%' || p_keyword || '%' THEN 'account'
      ELSE NULL
    END AS matched_field
  FROM "transfers" t
  WHERE t.user_id = auth.uid()
    AND (p_keyword IS NULL
      OR t.note ILIKE '%' || p_keyword || '%'
      OR t.primary_category ILIKE '%' || p_keyword || '%'
      OR t.secondary_category ILIKE '%' || p_keyword || '%'
      OR t.account ILIKE '%' || p_keyword || '%'
    )
    AND (p_accounts IS NULL OR t.account = ANY(p_accounts))
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
    AND (p_tags IS NULL OR t.tags && p_tags)
    AND (p_start_date IS NULL OR t.date >= p_start_date)
    AND (p_end_date IS NULL OR t.date <= p_end_date)
    AND (p_min_amount IS NULL OR GREATEST(t.inflow_amount, t.outflow_amount) >= p_min_amount)
    AND (p_max_amount IS NULL OR GREATEST(t.inflow_amount, t.outflow_amount) <= p_max_amount)
    AND (p_year IS NULL OR t.year = p_year)
    AND (p_month IS NULL OR t.month = p_month)
    AND (p_currency IS NULL OR t.currency = p_currency)
  ORDER BY t.date DESC, t.created_at DESC
  LIMIT v_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION "public"."search_transfers_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) IS
'Fuzzy search transfers with filters including keyword, account, transaction_type, tags, date range, amount range, year, month, currency. Amount range matches on GREATEST(inflow_amount, outflow_amount). Enforces user isolation via auth.uid(). Results limited to 500 max per query.';


-- ============================================================================
-- FUNCTION: get_financial_metadata
-- Server-side aggregation of distinct metadata from transactions + transfers
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_financial_metadata"()
RETURNS JSON
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'years', (
      SELECT COALESCE(json_agg(y ORDER BY y DESC), '[]'::json)
      FROM (
        SELECT DISTINCT year AS y FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT year AS y FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'accounts', (
      SELECT COALESCE(json_agg(a ORDER BY a), '[]'::json)
      FROM (
        SELECT DISTINCT account AS a FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT account AS a FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'categories', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT primary_category AS c FROM transactions WHERE user_id = auth.uid()
      ) sub
    ),
    'secondary_categories', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT secondary_category AS c FROM transactions
        WHERE user_id = auth.uid()
          AND secondary_category IS NOT NULL AND secondary_category != ''
      ) sub
    ),
    'tertiary_categories', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT tertiary_category AS c FROM transactions
        WHERE user_id = auth.uid()
          AND tertiary_category IS NOT NULL AND tertiary_category != ''
      ) sub
    ),
    'currencies', (
      SELECT COALESCE(json_agg(c ORDER BY c), '[]'::json)
      FROM (
        SELECT DISTINCT currency AS c FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT currency AS c FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'tags', (
      SELECT COALESCE(json_agg(t ORDER BY t), '[]'::json)
      FROM (
        SELECT DISTINCT unnest(tags) AS t FROM transactions WHERE user_id = auth.uid()
        UNION
        SELECT DISTINCT unnest(tags) AS t FROM transfers WHERE user_id = auth.uid()
      ) sub
    ),
    'transaction_count', (
      SELECT count(*) FROM transactions WHERE user_id = auth.uid()
    ),
    'transfer_count', (
      SELECT count(*) FROM transfers WHERE user_id = auth.uid()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION "public"."get_financial_metadata"() IS
'Returns distinct metadata (years, accounts, categories at 3 levels, currencies, tags, counts) aggregated server-side. AI agents should call this first to discover available filter values before using query_transactions or query_transfers.';


-- ============================================================================
-- FUNCTION: get_monthly_report
-- Monthly financial aggregation with income/expense/transfer breakdowns
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_monthly_report"(
  p_year     INTEGER,
  p_month    INTEGER,
  p_currency TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'year', p_year,
    'month', p_month,

    'total_income', (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND type = 'income'
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'total_expense', (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND type = 'expense'
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'net_amount', (
      SELECT COALESCE(SUM(
        CASE WHEN type = 'income' THEN amount
             WHEN type = 'expense' THEN -amount
             ELSE 0 END
      ), 0)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'transaction_count', (
      SELECT count(*)
      FROM transactions
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'transfer_count', (
      SELECT count(*)
      FROM transfers
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'total_transfer_in', (
      SELECT COALESCE(SUM(inflow_amount), 0)
      FROM transfers
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'total_transfer_out', (
      SELECT COALESCE(SUM(outflow_amount), 0)
      FROM transfers
      WHERE user_id = auth.uid()
        AND year = p_year AND month = p_month
        AND (p_currency IS NULL OR currency = p_currency)
    ),

    'expense_by_category', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.total DESC), '[]'::json)
      FROM (
        SELECT primary_category AS category, SUM(amount) AS total, count(*) AS count
        FROM transactions
        WHERE user_id = auth.uid()
          AND year = p_year AND month = p_month
          AND type = 'expense'
          AND (p_currency IS NULL OR currency = p_currency)
        GROUP BY primary_category
      ) sub
    ),

    'income_by_category', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.total DESC), '[]'::json)
      FROM (
        SELECT primary_category AS category, SUM(amount) AS total, count(*) AS count
        FROM transactions
        WHERE user_id = auth.uid()
          AND year = p_year AND month = p_month
          AND type = 'income'
          AND (p_currency IS NULL OR currency = p_currency)
        GROUP BY primary_category
      ) sub
    ),

    'currencies', (
      SELECT COALESCE(json_agg(DISTINCT c ORDER BY c), '[]'::json)
      FROM (
        SELECT currency AS c FROM transactions
        WHERE user_id = auth.uid() AND year = p_year AND month = p_month
        UNION
        SELECT currency AS c FROM transfers
        WHERE user_id = auth.uid() AND year = p_year AND month = p_month
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION "public"."get_monthly_report"(INTEGER, INTEGER, TEXT) IS
'Monthly financial report with income/expense totals, net amount, transfer flows, category breakdowns, and currency list. Requires year + month. Optional currency filter for multi-currency users.';


-- ============================================================================
-- GRANTS
-- ============================================================================

-- Schema access
GRANT USAGE ON SCHEMA "public" TO "anon", "authenticated", "service_role";

-- Table access (RLS policies enforce data isolation)
GRANT ALL ON TABLE "public"."financial_products" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."capital_units" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."transfers" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."settings" TO "authenticated", "service_role";

-- Sequence access
GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "authenticated", "service_role";

-- Function access
GRANT ALL ON FUNCTION "public"."get_units_with_products"() TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."search_transactions_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT[], TEXT[]) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."search_transfers_fuzzy"(TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_financial_metadata"() TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_monthly_report"(INTEGER, INTEGER, TEXT) TO "authenticated", "service_role";

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON SEQUENCES TO "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON FUNCTIONS TO "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON TABLES TO "authenticated", "service_role";
