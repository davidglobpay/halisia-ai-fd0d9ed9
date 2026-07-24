
-- ENUMS
CREATE TYPE public.bid_category AS ENUM ('construction','architecture','surveying','legal','engineering','landscaping','other');
CREATE TYPE public.bid_request_status AS ENUM ('open','awarded','closed');
CREATE TYPE public.bid_proposal_status AS ENUM ('submitted','shortlisted','accepted','rejected','withdrawn');
CREATE TYPE public.financing_purpose AS ENUM ('purchase','construction','refinance','bridge','equity_release','other');
CREATE TYPE public.financing_status AS ENUM ('draft','submitted','under_review','approved','rejected','funded','withdrawn');

-- BID REQUESTS
CREATE TABLE public.bid_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  category public.bid_category NOT NULL DEFAULT 'construction',
  budget_min NUMERIC,
  budget_max NUMERIC,
  currency TEXT NOT NULL DEFAULT 'KES',
  timeline TEXT,
  county TEXT,
  status public.bid_request_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_requests TO authenticated;
GRANT ALL ON public.bid_requests TO service_role;
ALTER TABLE public.bid_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own bid requests" ON public.bid_requests
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Signed-in users can view open bid requests" ON public.bid_requests
  FOR SELECT TO authenticated USING (status = 'open' OR auth.uid() = owner_id);
CREATE TRIGGER trg_bid_requests_updated_at
  BEFORE UPDATE ON public.bid_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BID PROPOSALS
CREATE TABLE public.bid_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_request_id UUID NOT NULL REFERENCES public.bid_requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'KES',
  timeline_days INTEGER,
  message TEXT,
  portfolio_url TEXT,
  status public.bid_proposal_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bid_request_id, provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_proposals TO authenticated;
GRANT ALL ON public.bid_proposals TO service_role;
ALTER TABLE public.bid_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provider manages own proposals" ON public.bid_proposals
  FOR ALL TO authenticated USING (auth.uid() = provider_id) WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Request owner can read proposals on their requests" ON public.bid_proposals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bid_requests r WHERE r.id = bid_request_id AND r.owner_id = auth.uid())
  );
CREATE POLICY "Request owner can update proposal status" ON public.bid_proposals
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bid_requests r WHERE r.id = bid_request_id AND r.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bid_requests r WHERE r.id = bid_request_id AND r.owner_id = auth.uid())
  );
CREATE TRIGGER trg_bid_proposals_updated_at
  BEFORE UPDATE ON public.bid_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FINANCING APPLICATIONS
CREATE TABLE public.financing_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  borrower_name TEXT NOT NULL,
  borrower_email TEXT,
  borrower_phone TEXT,
  monthly_income NUMERIC,
  employment_status TEXT,
  requested_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  purpose public.financing_purpose NOT NULL DEFAULT 'purchase',
  tenure_months INTEGER,
  property_value NUMERIC,
  property_address TEXT,
  notes TEXT,
  ai_summary JSONB,
  status public.financing_status NOT NULL DEFAULT 'draft',
  lender_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financing_applications TO authenticated;
GRANT ALL ON public.financing_applications TO service_role;
ALTER TABLE public.financing_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicant manages own financing applications" ON public.financing_applications
  FOR ALL TO authenticated USING (auth.uid() = applicant_id) WITH CHECK (auth.uid() = applicant_id);
CREATE TRIGGER trg_financing_updated_at
  BEFORE UPDATE ON public.financing_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INSURANCE BRIEFS
CREATE TABLE public.insurance_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_output JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_briefs TO authenticated;
GRANT ALL ON public.insurance_briefs TO service_role;
ALTER TABLE public.insurance_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read insurance briefs" ON public.insurance_briefs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Property owner can insert insurance brief" ON public.insurance_briefs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Property owner can update insurance brief" ON public.insurance_briefs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Property owner can delete insurance brief" ON public.insurance_briefs
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );
CREATE TRIGGER trg_insurance_briefs_updated_at
  BEFORE UPDATE ON public.insurance_briefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- indexes
CREATE INDEX idx_bid_requests_owner ON public.bid_requests(owner_id);
CREATE INDEX idx_bid_requests_status ON public.bid_requests(status);
CREATE INDEX idx_bid_proposals_request ON public.bid_proposals(bid_request_id);
CREATE INDEX idx_bid_proposals_provider ON public.bid_proposals(provider_id);
CREATE INDEX idx_financing_applicant ON public.financing_applications(applicant_id);
CREATE INDEX idx_financing_status ON public.financing_applications(status);
CREATE INDEX idx_insurance_briefs_property ON public.insurance_briefs(property_id);
