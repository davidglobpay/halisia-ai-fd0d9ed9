-- ============ ENUMS ============
CREATE TYPE public.mkt_source_type AS ENUM ('portal','developer','land_company','government','agency','partner');
CREATE TYPE public.mkt_integration_mode AS ENUM ('outbound','curated','feed','api','partner');
CREATE TYPE public.mkt_commercial_status AS ENUM ('discovery_only','outreach_pending','referral_partner','sales_partner');
CREATE TYPE public.mkt_listing_category AS ENUM ('land','house','apartment','commercial','industrial','agricultural','offplan','affordable_housing','rental','development','other');
CREATE TYPE public.mkt_listing_intent AS ENUM ('sale','rent','lease','apply');
CREATE TYPE public.mkt_verification_status AS ENUM ('SOURCE_LISTED','HALISIA_REVIEWED','HALISIA_VERIFIED');
CREATE TYPE public.mkt_freshness AS ENUM ('fresh','recent','stale','expired','unknown');
CREATE TYPE public.mkt_availability AS ENUM ('available','reserved','sold','let','withdrawn','unknown');
CREATE TYPE public.mkt_agreement_status AS ENUM ('draft','active','suspended','expired','terminated');
CREATE TYPE public.mkt_fee_method AS ENUM ('percentage','flat','hybrid','tiered');
CREATE TYPE public.mkt_referral_event AS ENUM (
  'LISTING_IMPRESSION','LISTING_CLICK','EXPLORE_HALISIA','SOURCE_OUTBOUND_CLICK',
  'ENQUIRY_STARTED','ENQUIRY_COMPLETED','CALLBACK_REQUESTED','VIEWING_REQUESTED','VIEWING_BOOKED',
  'VIEWING_COMPLETED','OFFER_STARTED','OFFER_SUBMITTED','RESERVATION','TRANSACTION_PENDING',
  'CLOSED_WON','CLOSED_LOST');
CREATE TYPE public.mkt_lead_status AS ENUM ('new','contacted','qualified','viewing','negotiation','won','lost','spam');
CREATE TYPE public.mkt_transaction_status AS ENUM ('pending','closed_won','closed_lost','cancelled','refunded','partially_refunded');
CREATE TYPE public.mkt_commission_state AS ENUM ('pending','approved','disputed','invoiced','paid','reversed');
CREATE TYPE public.mkt_payout_state AS ENUM ('draft','invoiced','paid','failed','cancelled');
CREATE TYPE public.mkt_evidence_class AS ENUM ('registry','survey','legal','professional','official_publication','partner_attested');

-- ============ 1. SOURCES ============
CREATE TABLE public.marketplace_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  source_type public.mkt_source_type NOT NULL,
  website_url text,
  logo_url text,
  description text,
  integration_mode public.mkt_integration_mode NOT NULL DEFAULT 'outbound',
  commercial_status public.mkt_commercial_status NOT NULL DEFAULT 'discovery_only',
  default_referral_rate numeric,
  can_display_images boolean NOT NULL DEFAULT false,
  can_display_description boolean NOT NULL DEFAULT false,
  can_display_floorplans boolean NOT NULL DEFAULT false,
  can_store_locally boolean NOT NULL DEFAULT false,
  can_republish boolean NOT NULL DEFAULT false,
  partner_feed boolean NOT NULL DEFAULT false,
  rights_basis text,
  rights_checked_at timestamptz,
  rights_expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_sources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_sources TO authenticated;
GRANT ALL ON public.marketplace_sources TO service_role;
ALTER TABLE public.marketplace_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources public read active" ON public.marketplace_sources FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "sources admin all" ON public.marketplace_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_sources_updated_at BEFORE UPDATE ON public.marketplace_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 1b. SOURCE MEMBERS (partner users) ============
CREATE TABLE public.marketplace_source_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, user_id)
);
GRANT SELECT ON public.marketplace_source_members TO authenticated;
GRANT ALL ON public.marketplace_source_members TO service_role;
ALTER TABLE public.marketplace_source_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own" ON public.marketplace_source_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members admin all" ON public.marketplace_source_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE OR REPLACE FUNCTION public.is_source_member(_source_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_source_members m
                 WHERE m.source_id = _source_id AND m.user_id = auth.uid())
$$;

-- ============ 2. EXTERNAL LISTINGS ============
CREATE TABLE public.marketplace_external_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  source_listing_id text NOT NULL,
  canonical_url text,
  original_listing_url text,
  title text NOT NULL,
  project_name text,
  developer_name text,
  listing_category public.mkt_listing_category NOT NULL DEFAULT 'other',
  intent public.mkt_listing_intent NOT NULL DEFAULT 'sale',
  county text,
  locality text,
  address text,
  latitude double precision,
  longitude double precision,
  bedrooms integer,
  bathrooms integer,
  size_value numeric,
  size_unit text,
  price numeric,
  currency text NOT NULL DEFAULT 'KES',
  price_qualifier text,
  booking_amount numeric,
  payment_plan_summary text,
  completion_date date,
  tenure text,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_checked_at timestamptz,
  source_updated_at timestamptz,
  availability_status public.mkt_availability NOT NULL DEFAULT 'unknown',
  freshness public.mkt_freshness NOT NULL DEFAULT 'unknown',
  verification_status public.mkt_verification_status NOT NULL DEFAULT 'SOURCE_LISTED',
  hero_image_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_listing_id)
);
CREATE INDEX idx_mkt_ext_listings_active ON public.marketplace_external_listings (active, listing_category, county);
CREATE INDEX idx_mkt_ext_listings_source ON public.marketplace_external_listings (source_id);
GRANT SELECT ON public.marketplace_external_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_external_listings TO authenticated;
GRANT ALL ON public.marketplace_external_listings TO service_role;
ALTER TABLE public.marketplace_external_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ext listings public read active" ON public.marketplace_external_listings FOR SELECT TO anon, authenticated
  USING (active AND EXISTS (SELECT 1 FROM public.marketplace_sources s WHERE s.id = source_id AND s.active));
CREATE POLICY "ext listings partner read own" ON public.marketplace_external_listings FOR SELECT TO authenticated
  USING (public.is_source_member(source_id));
CREATE POLICY "ext listings admin all" ON public.marketplace_external_listings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_ext_listings_updated_at BEFORE UPDATE ON public.marketplace_external_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- price/state history (never silently erase prior price)
CREATE TABLE public.marketplace_listing_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_external_listings(id) ON DELETE CASCADE,
  price numeric,
  currency text,
  booking_amount numeric,
  availability_status public.mkt_availability,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_price_history_listing ON public.marketplace_listing_price_history (listing_id, observed_at DESC);
GRANT SELECT ON public.marketplace_listing_price_history TO anon, authenticated;
GRANT ALL ON public.marketplace_listing_price_history TO service_role;
ALTER TABLE public.marketplace_listing_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price history public read" ON public.marketplace_listing_price_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "price history admin write" ON public.marketplace_listing_price_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE OR REPLACE FUNCTION public.mkt_record_price_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.booking_amount IS DISTINCT FROM OLD.booking_amount
     OR NEW.availability_status IS DISTINCT FROM OLD.availability_status THEN
    INSERT INTO public.marketplace_listing_price_history (listing_id, price, currency, booking_amount, availability_status)
    VALUES (NEW.id, NEW.price, NEW.currency, NEW.booking_amount, NEW.availability_status);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_mkt_price_history AFTER INSERT OR UPDATE ON public.marketplace_external_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_record_price_change();

-- ============ 3. VERIFICATION EVIDENCE ============
CREATE TABLE public.marketplace_verification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_external_listings(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  authority text NOT NULL,
  source_record_id text,
  source_record_url text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL,
  record_class public.mkt_evidence_class NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketplace_verification_evidence TO authenticated;
GRANT ALL ON public.marketplace_verification_evidence TO service_role;
ALTER TABLE public.marketplace_verification_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence admin all" ON public.marketplace_verification_evidence FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- HALISIA_VERIFIED requires qualifying evidence; AI/completeness can never verify.
CREATE OR REPLACE FUNCTION public.mkt_enforce_verification_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.verification_status = 'HALISIA_VERIFIED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.marketplace_verification_evidence e
      WHERE e.listing_id = NEW.id
        AND e.record_class IN ('registry','survey','legal','professional')
    ) THEN
      RAISE EXCEPTION 'HALISIA_VERIFIED requires qualifying verification evidence for listing %', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_mkt_verification_guard BEFORE INSERT OR UPDATE ON public.marketplace_external_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_enforce_verification_evidence();

-- ============ 4. PARTNER AGREEMENTS ============
CREATE TABLE public.marketplace_partner_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  agreement_type text NOT NULL DEFAULT 'referral',
  status public.mkt_agreement_status NOT NULL DEFAULT 'draft',
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  currency text NOT NULL DEFAULT 'KES',
  fee_method public.mkt_fee_method NOT NULL,
  percentage_rate numeric,
  flat_fee numeric,
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_fee numeric,
  max_fee numeric,
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  attribution_window_days integer NOT NULL DEFAULT 90,
  tax_rate numeric,
  tax_inclusive boolean NOT NULL DEFAULT false,
  signed_at timestamptz,
  signed_by text,
  evidence_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, version)
);
GRANT SELECT ON public.marketplace_partner_agreements TO authenticated;
GRANT ALL ON public.marketplace_partner_agreements TO service_role;
ALTER TABLE public.marketplace_partner_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agreements partner read own" ON public.marketplace_partner_agreements FOR SELECT TO authenticated
  USING (public.is_source_member(source_id));
CREATE POLICY "agreements admin all" ON public.marketplace_partner_agreements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_agreements_updated_at BEFORE UPDATE ON public.marketplace_partner_agreements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 5. REFERRALS + EVENTS ============
CREATE TABLE public.marketplace_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL UNIQUE,
  source_id uuid REFERENCES public.marketplace_sources(id) ON DELETE SET NULL,
  external_listing_id uuid REFERENCES public.marketplace_external_listings(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hash text,
  attribution_window_days integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_referrals_source ON public.marketplace_referrals (source_id, created_at DESC);
GRANT INSERT, SELECT ON public.marketplace_referrals TO anon, authenticated;
GRANT ALL ON public.marketplace_referrals TO service_role;
ALTER TABLE public.marketplace_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals insert any" ON public.marketplace_referrals FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "referrals read own" ON public.marketplace_referrals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "referrals partner read own source" ON public.marketplace_referrals FOR SELECT TO authenticated
  USING (source_id IS NOT NULL AND public.is_source_member(source_id));
CREATE POLICY "referrals admin all" ON public.marketplace_referrals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.marketplace_referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.marketplace_referrals(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.marketplace_sources(id) ON DELETE SET NULL,
  external_listing_id uuid REFERENCES public.marketplace_external_listings(id) ON DELETE SET NULL,
  event_type public.mkt_referral_event NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  override_reason text,
  override_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_mkt_referral_events_ref ON public.marketplace_referral_events (referral_id, occurred_at DESC);
GRANT INSERT ON public.marketplace_referral_events TO anon, authenticated;
GRANT SELECT ON public.marketplace_referral_events TO authenticated;
GRANT ALL ON public.marketplace_referral_events TO service_role;
ALTER TABLE public.marketplace_referral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral events insert any" ON public.marketplace_referral_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "referral events partner read" ON public.marketplace_referral_events FOR SELECT TO authenticated
  USING (source_id IS NOT NULL AND public.is_source_member(source_id));
CREATE POLICY "referral events admin all" ON public.marketplace_referral_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ 6. LEADS (PII) ============
CREATE TABLE public.marketplace_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.marketplace_referrals(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.marketplace_sources(id) ON DELETE SET NULL,
  external_listing_id uuid REFERENCES public.marketplace_external_listings(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  message text,
  enquiry_type text NOT NULL DEFAULT 'enquiry',
  consent_partner_contact boolean NOT NULL DEFAULT false,
  consent_partner_contact_at timestamptz,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_marketing_at timestamptz,
  consent_receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.mkt_lead_status NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_leads_source ON public.marketplace_leads (source_id, created_at DESC);
GRANT INSERT, SELECT ON public.marketplace_leads TO anon, authenticated;
GRANT UPDATE ON public.marketplace_leads TO authenticated;
GRANT ALL ON public.marketplace_leads TO service_role;
ALTER TABLE public.marketplace_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads insert with consent" ON public.marketplace_leads FOR INSERT TO anon, authenticated
  WITH CHECK (consent_partner_contact = true AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "leads read own" ON public.marketplace_leads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "leads partner read own source" ON public.marketplace_leads FOR SELECT TO authenticated
  USING (source_id IS NOT NULL AND public.is_source_member(source_id));
CREATE POLICY "leads partner update own source" ON public.marketplace_leads FOR UPDATE TO authenticated
  USING (source_id IS NOT NULL AND public.is_source_member(source_id))
  WITH CHECK (source_id IS NOT NULL AND public.is_source_member(source_id));
CREATE POLICY "leads admin all" ON public.marketplace_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_leads_updated_at BEFORE UPDATE ON public.marketplace_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 7. TRANSACTIONS ============
CREATE TABLE public.marketplace_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.marketplace_referrals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.marketplace_leads(id) ON DELETE SET NULL,
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  external_listing_id uuid REFERENCES public.marketplace_external_listings(id) ON DELETE SET NULL,
  transaction_value numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  status public.mkt_transaction_status NOT NULL DEFAULT 'pending',
  closed_at timestamptz,
  close_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  refunded_amount numeric NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_transactions TO authenticated;
GRANT ALL ON public.marketplace_transactions TO service_role;
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx partner read own" ON public.marketplace_transactions FOR SELECT TO authenticated USING (public.is_source_member(source_id));
CREATE POLICY "tx admin all" ON public.marketplace_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_tx_updated_at BEFORE UPDATE ON public.marketplace_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 8. COMMISSIONS ============
CREATE TABLE public.marketplace_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.marketplace_transactions(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES public.marketplace_partner_agreements(id),
  agreement_version integer NOT NULL,
  agreement_snapshot jsonb NOT NULL,
  calc_method public.mkt_fee_method NOT NULL,
  base_amount numeric NOT NULL,
  currency text NOT NULL,
  applied_rate numeric,
  applied_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  gross_amount numeric NOT NULL,
  tax_amount numeric NOT NULL DEFAULT 0,
  refund_adjustment numeric NOT NULL DEFAULT 0,
  clawback_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  state public.mkt_commission_state NOT NULL DEFAULT 'pending',
  calculation_id text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);
GRANT SELECT ON public.marketplace_commissions TO authenticated;
GRANT ALL ON public.marketplace_commissions TO service_role;
ALTER TABLE public.marketplace_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions partner read own" ON public.marketplace_commissions FOR SELECT TO authenticated USING (public.is_source_member(source_id));
CREATE POLICY "commissions admin all" ON public.marketplace_commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_commissions_updated_at BEFORE UPDATE ON public.marketplace_commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 9. PAYOUTS ============
CREATE TABLE public.marketplace_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.marketplace_commissions(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  invoice_ref text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  state public.mkt_payout_state NOT NULL DEFAULT 'draft',
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_payouts TO authenticated;
GRANT ALL ON public.marketplace_payouts TO service_role;
ALTER TABLE public.marketplace_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts partner read own" ON public.marketplace_payouts FOR SELECT TO authenticated USING (public.is_source_member(source_id));
CREATE POLICY "payouts admin all" ON public.marketplace_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_payouts_updated_at BEFORE UPDATE ON public.marketplace_payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 10. SYNC RUNS ============
CREATE TABLE public.marketplace_source_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.marketplace_sources(id) ON DELETE CASCADE,
  mode public.mkt_integration_mode NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  archived_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  error_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT ON public.marketplace_source_sync_runs TO authenticated;
GRANT ALL ON public.marketplace_source_sync_runs TO service_role;
ALTER TABLE public.marketplace_source_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync runs partner read own" ON public.marketplace_source_sync_runs FOR SELECT TO authenticated USING (public.is_source_member(source_id));
CREATE POLICY "sync runs admin all" ON public.marketplace_source_sync_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ 11. FEATURE FLAGS ============
CREATE TABLE public.marketplace_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_feature_flags TO anon, authenticated;
GRANT ALL ON public.marketplace_feature_flags TO service_role;
ALTER TABLE public.marketplace_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags public read" ON public.marketplace_feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "flags admin write" ON public.marketplace_feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_mkt_flags_updated_at BEFORE UPDATE ON public.marketplace_feature_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();