-- Initial Schema
-- Generated from Supabase Cloud
-- Date: 2025-01-01

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";


-- ============================================================================
-- FUNCTION: get_units_with_products
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
    u.created_at,
    to_jsonb(p) AS product
  FROM capital_units u
  LEFT JOIN financial_products p ON u.product_id = p.id
  WHERE u.user_id = auth.uid()
  ORDER BY u.created_at DESC;
END;
$$;


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

-- Foreign Keys
ALTER TABLE "public"."capital_units"
  ADD CONSTRAINT "capital_units_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."capital_units"
  ADD CONSTRAINT "capital_units_product_id_fkey" FOREIGN KEY ("product_id")
  REFERENCES "public"."financial_products"("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_capital_units_user" ON "public"."capital_units" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_capital_units_product" ON "public"."capital_units" USING "btree" ("product_id");

-- RLS
ALTER TABLE "public"."capital_units" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_policy" ON "public"."capital_units"
  FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "units_insert_policy" ON "public"."capital_units"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "units_update_policy" ON "public"."capital_units"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "units_delete_policy" ON "public"."capital_units"
  FOR DELETE USING (("auth"."uid"() = "user_id"));


-- ============================================================================
-- TABLE: financial_products (理财产品)
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

-- Foreign Keys
ALTER TABLE "public"."financial_products"
  ADD CONSTRAINT "financial_products_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_financial_products_user" ON "public"."financial_products" USING "btree" ("user_id");

-- RLS
ALTER TABLE "public"."financial_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_policy" ON "public"."financial_products"
  FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "products_insert_policy" ON "public"."financial_products"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "products_update_policy" ON "public"."financial_products"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "products_delete_policy" ON "public"."financial_products"
  FOR DELETE USING (("auth"."uid"() = "user_id"));


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

-- Foreign Keys
ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_transactions_user_year" ON "public"."transactions" USING "btree" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "public"."transactions" USING "btree" ("date");
CREATE INDEX IF NOT EXISTS "idx_transactions_type" ON "public"."transactions" USING "btree" ("type");
CREATE INDEX IF NOT EXISTS "idx_transactions_primary_category" ON "public"."transactions" USING "btree" ("primary_category");

-- RLS
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON "public"."transactions"
  FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own transactions" ON "public"."transactions"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own transactions" ON "public"."transactions"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own transactions" ON "public"."transactions"
  FOR DELETE USING (("auth"."uid"() = "user_id"));


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

-- Foreign Keys
ALTER TABLE "public"."settings"
  ADD CONSTRAINT "site_metadata_owner_id_fkey" FOREIGN KEY ("owner_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- RLS
ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON "public"."settings"
  FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));

CREATE POLICY "Users can insert own data" ON "public"."settings"
  FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));

CREATE POLICY "Users can update own data" ON "public"."settings"
  FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));

CREATE POLICY "Users can delete own data" ON "public"."settings"
  FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));


-- ============================================================================
-- GRANTS
-- ============================================================================
-- IMPORTANT: Security best practices for Supabase
-- - anon: Unauthenticated users (using anon key) - minimal permissions
-- - authenticated: Logged-in users - RLS-controlled access
-- - service_role: Backend service - full access (bypasses RLS)
--
-- Reference: https://supabase.com/docs/guides/auth/row-level-security

-- Schema access (required for all roles)
GRANT USAGE ON SCHEMA "public" TO "anon", "authenticated", "service_role";

-- Function access (only for authenticated users and service_role)
GRANT ALL ON FUNCTION "public"."get_units_with_products"() TO "authenticated", "service_role";

-- Table access (RLS policies enforce data isolation)
-- authenticated: Full CRUD but limited by RLS to own data
-- service_role: Full access (bypasses RLS)
-- anon: NO table access (prevents unauthorized operations)
GRANT ALL ON TABLE "public"."capital_units" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."financial_products" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."settings" TO "authenticated", "service_role";

-- Sequence access
GRANT ALL ON SEQUENCE "public"."site_metadata_id_seq" TO "authenticated", "service_role";

-- Default privileges for future objects (DO NOT grant to anon)
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON SEQUENCES TO "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON FUNCTIONS TO "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON TABLES TO "authenticated", "service_role";
