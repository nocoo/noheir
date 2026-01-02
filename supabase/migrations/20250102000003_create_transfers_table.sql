-- Create Transfers Table
-- This table stores transfer/transaction records between accounts
-- Date: 2025-01-02

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

-- Foreign Keys
ALTER TABLE "public"."transfers"
  ADD CONSTRAINT "transfers_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_transfers_user_year" ON "public"."transfers" USING "btree" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "idx_transfers_date" ON "public"."transfers" USING "btree" ("date");
CREATE INDEX IF NOT EXISTS "idx_transfers_account" ON "public"."transfers" USING "btree" ("account");
CREATE INDEX IF NOT EXISTS "idx_transfers_primary_category" ON "public"."transfers" USING "btree" ("primary_category");

-- RLS (Row Level Security)
ALTER TABLE "public"."transfers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfers" ON "public"."transfers"
  FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own transfers" ON "public"."transfers"
  FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own transfers" ON "public"."transfers"
  FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own transfers" ON "public"."transfers"
  FOR DELETE USING (("auth"."uid"() = "user_id"));

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Grant access to authenticated users and service_role
GRANT ALL ON TABLE "public"."transfers" TO "authenticated", "service_role";

-- Add default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON TABLES TO "authenticated", "service_role";
