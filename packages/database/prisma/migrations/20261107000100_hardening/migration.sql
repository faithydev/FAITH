-- Search across every language FAITH serves. Trigram indexes work for Uzbek, Cyrillic,
-- Arabic and CJK alike, where a single-language tsvector configuration would not.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_title_trgm_idx" ON "Product" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Product_summary_trgm_idx" ON "Product" USING gin ("summary" gin_trgm_ops);
CREATE INDEX "Job_title_trgm_idx" ON "Job" USING gin ("title" gin_trgm_ops);
CREATE INDEX "ServiceListing_title_trgm_idx" ON "ServiceListing" USING gin ("title" gin_trgm_ops);
CREATE INDEX "BrandCampaign_title_trgm_idx" ON "BrandCampaign" USING gin ("title" gin_trgm_ops);
CREATE INDEX "AppListing_name_trgm_idx" ON "AppListing" USING gin ("name" gin_trgm_ops);

-- Ledger rules. Application code is not trusted to keep them.

-- 1. Amounts are strictly positive; direction carries the sign.
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amountMinor" > 0);

-- 2. Entries and transactions can never be changed or removed. Corrections are new
--    reversing transactions.
CREATE FUNCTION faith_ledger_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger records are immutable (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_immutable" BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION faith_ledger_immutable();
CREATE TRIGGER "LedgerTransaction_immutable" BEFORE UPDATE OR DELETE ON "LedgerTransaction"
  FOR EACH ROW EXECUTE FUNCTION faith_ledger_immutable();

-- 3. Every transaction balances, checked at commit so entries can be inserted one by one.
CREATE FUNCTION faith_ledger_balanced() RETURNS trigger AS $$
DECLARE
  imbalance numeric;
  entry_count integer;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN "direction" = 'DEBIT' THEN "amountMinor" ELSE -"amountMinor" END), 0), COUNT(*)
    INTO imbalance, entry_count
    FROM "LedgerEntry" WHERE "transactionId" = NEW."transactionId";
  IF entry_count < 2 OR imbalance <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % does not balance (entries=%, imbalance=%)',
      NEW."transactionId", entry_count, imbalance;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "LedgerEntry_balanced" AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION faith_ledger_balanced();

-- 4. An entry's currency must match its account.
CREATE FUNCTION faith_ledger_currency() RETURNS trigger AS $$
DECLARE
  tx_currency text;
  acct_currency text;
BEGIN
  SELECT "currency" INTO tx_currency FROM "LedgerTransaction" WHERE "id" = NEW."transactionId";
  SELECT "currency" INTO acct_currency FROM "LedgerAccount" WHERE "id" = NEW."accountId";
  IF tx_currency IS DISTINCT FROM acct_currency THEN
    RAISE EXCEPTION 'currency mismatch: transaction % vs account %', tx_currency, acct_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_currency" BEFORE INSERT ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION faith_ledger_currency();

-- Other financial invariants.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_nonnegative" CHECK ("priceMinor" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_refund_within_net" CHECK ("refundedMinor" >= 0 AND "refundedMinor" <= "netMinor");
ALTER TABLE "SellerOrder" ADD CONSTRAINT "SellerOrder_refund_within_net" CHECK ("refundedMinor" >= 0 AND "refundedMinor" <= "netMinor");
ALTER TABLE "BrandCampaign" ADD CONSTRAINT "BrandCampaign_accrued_within_funded" CHECK ("accruedMinor" >= 0 AND "accruedMinor" <= "fundedMinor");
ALTER TABLE "CustomerReview" ADD CONSTRAINT "CustomerReview_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "AppReview" ADD CONSTRAINT "AppReview_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "RevenueShare" ADD CONSTRAINT "RevenueShare_bps_range" CHECK ("bps" BETWEEN 1 AND 10000);
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_rollout_range" CHECK ("rolloutPct" BETWEEN 0 AND 100);
