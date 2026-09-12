-- 1. Reconcile unversioned production hotfixes (idempotent) ---------------

-- 1a. Overly broad referral-event insert must stay absent.
DROP POLICY IF EXISTS "referral events insert any" ON public.marketplace_referral_events;
DROP POLICY IF EXISTS "referral events insert public" ON public.marketplace_referral_events;
DROP POLICY IF EXISTS "referral events public insert" ON public.marketplace_referral_events;

-- 1b. Professional verification guard.
CREATE OR REPLACE FUNCTION public.halisia_guard_professional_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NOT public.has_role(auth.uid(), 'administrator'::public.app_role) THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.verification_note IS DISTINCT FROM OLD.verification_note THEN
      RAISE EXCEPTION 'professional verification fields are administrator-controlled'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_halisia_guard_professional_verification ON public.professional_profiles;
CREATE TRIGGER trg_halisia_guard_professional_verification
BEFORE UPDATE ON public.professional_profiles
FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_professional_verification();

-- 1c. Contribution review/reward guard.
CREATE OR REPLACE FUNCTION public.halisia_guard_contribution_review_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NOT public.has_role(auth.uid(), 'administrator'::public.app_role) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reward_points IS DISTINCT FROM OLD.reward_points
       OR NEW.quality_score IS DISTINCT FROM OLD.quality_score
       OR NEW.reviewer_note IS DISTINCT FROM OLD.reviewer_note THEN
      RAISE EXCEPTION 'contribution review and reward fields are administrator-controlled'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_halisia_guard_contribution_review_fields ON public.contributions;
CREATE TRIGGER trg_halisia_guard_contribution_review_fields
BEFORE UPDATE ON public.contributions
FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_contribution_review_fields();

-- 2. Privileged land-verification roles are not self-assignable ----------

CREATE OR REPLACE FUNCTION public.is_privileged_role(_role public.app_role)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT _role = ANY (ARRAY[
    'administrator','surveyor','valuer','government_partner'
  ]::public.app_role[])
$$;

DROP POLICY IF EXISTS "add own roles" ON public.user_roles;
CREATE POLICY "add own non-privileged roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND NOT public.is_privileged_role(role))
  OR public.has_role(auth.uid(), 'administrator'::public.app_role)
);

DROP POLICY IF EXISTS "remove own roles" ON public.user_roles;
CREATE POLICY "remove own non-privileged roles" ON public.user_roles
FOR DELETE TO authenticated
USING (
  (auth.uid() = user_id AND NOT public.is_privileged_role(role))
  OR public.has_role(auth.uid(), 'administrator'::public.app_role)
);

-- 3. Parcel verification events: authority actors only, server-stamped ---

CREATE OR REPLACE FUNCTION public.is_verified_surveyor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professional_profiles p
    WHERE p.user_id = _user_id
      AND p.category = 'surveyor'::public.pro_category
      AND p.verification_status = 'verified'::public.pro_verification
  )
$$;

CREATE OR REPLACE FUNCTION public.stamp_verification_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.actor_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stamp_verification_actor ON public.parcel_verification_events;
CREATE TRIGGER trg_stamp_verification_actor
BEFORE INSERT ON public.parcel_verification_events
FOR EACH ROW EXECUTE FUNCTION public.stamp_verification_actor();

DROP POLICY IF EXISTS "Reviewers can record verification events" ON public.parcel_verification_events;
CREATE POLICY "Authority reviewers record verification events" ON public.parcel_verification_events
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'administrator'::public.app_role)
    OR public.is_verified_surveyor(auth.uid())
  )
);

-- 4. Parcel owners cannot edit authority-controlled verification fields --

CREATE OR REPLACE FUNCTION public.halisia_guard_parcel_verification_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = OLD.owner_id
     AND NOT public.has_role(auth.uid(), 'administrator'::public.app_role) THEN
    IF NEW.verification_state IS DISTINCT FROM OLD.verification_state
       OR NEW.verification_confidence IS DISTINCT FROM OLD.verification_confidence
       OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
       OR NEW.verification_evidence_ref IS DISTINCT FROM OLD.verification_evidence_ref
       OR NEW.verification_updated_at IS DISTINCT FROM OLD.verification_updated_at
       OR NEW.survey_verified_on IS DISTINCT FROM OLD.survey_verified_on THEN
      RAISE EXCEPTION 'parcel verification fields are authority-controlled'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_halisia_guard_parcel_verification_fields ON public.parcels;
CREATE TRIGGER trg_halisia_guard_parcel_verification_fields
BEFORE UPDATE ON public.parcels
FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_parcel_verification_fields();

-- 5. Referrals: server-minted only ---------------------------------------

DROP POLICY IF EXISTS "referrals insert any" ON public.marketplace_referrals;

CREATE OR REPLACE FUNCTION public.mkt_create_referral(
  p_source_id uuid DEFAULT NULL,
  p_external_listing_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL
) RETURNS TABLE(id uuid, referral_code text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_source_id uuid := p_source_id;
  v_window int := 30;
  v_code text := replace(gen_random_uuid()::text, '-', '');
  v_row public.marketplace_referrals%ROWTYPE;
BEGIN
  IF p_external_listing_id IS NOT NULL THEN
    SELECT l.source_id INTO v_source_id
    FROM public.marketplace_external_listings l
    JOIN public.marketplace_sources s ON s.id = l.source_id
    WHERE l.id = p_external_listing_id AND l.active AND s.active;
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION 'listing not available' USING ERRCODE = '22023';
    END IF;
  ELSIF v_source_id IS NOT NULL THEN
    PERFORM 1 FROM public.marketplace_sources s WHERE s.id = v_source_id AND s.active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'source not available' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.marketplace_referrals (
    referral_code, source_id, external_listing_id, property_id,
    user_id, session_hash, attribution_window_days, expires_at
  ) VALUES (
    v_code, v_source_id, p_external_listing_id, p_property_id,
    auth.uid(), md5(v_code), v_window, now() + (v_window || ' days')::interval
  ) RETURNING * INTO v_row;

  id := v_row.id; referral_code := v_row.referral_code; expires_at := v_row.expires_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_create_referral(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_create_referral(uuid, uuid, uuid) TO anon, authenticated, service_role;

-- 6. Leads: server-validated, consent-gated ------------------------------

DROP POLICY IF EXISTS "leads insert with consent" ON public.marketplace_leads;

CREATE OR REPLACE FUNCTION public.mkt_create_lead(
  p_full_name text,
  p_consent_partner_contact boolean,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_enquiry_type text DEFAULT 'enquiry',
  p_external_listing_id uuid DEFAULT NULL,
  p_referral_id uuid DEFAULT NULL,
  p_consent_marketing boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_source_id uuid;
  v_now timestamptz := now();
  v_ref public.marketplace_referrals%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_consent_partner_contact IS NOT TRUE THEN
    RAISE EXCEPTION 'partner contact consent is required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_full_name), '') = '' THEN
    RAISE EXCEPTION 'full name is required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_email), '') = '' AND coalesce(btrim(p_phone), '') = '' THEN
    RAISE EXCEPTION 'an email address or phone number is required' USING ERRCODE = '22023';
  END IF;

  IF p_external_listing_id IS NOT NULL THEN
    SELECT l.source_id INTO v_source_id
    FROM public.marketplace_external_listings l
    JOIN public.marketplace_sources s ON s.id = l.source_id
    WHERE l.id = p_external_listing_id AND l.active AND s.active;
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION 'listing not available' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_referral_id IS NOT NULL THEN
    SELECT * INTO v_ref FROM public.marketplace_referrals r WHERE r.id = p_referral_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'referral not found' USING ERRCODE = '22023';
    END IF;
    IF v_ref.user_id IS NOT NULL AND v_ref.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'referral does not belong to this session' USING ERRCODE = '42501';
    END IF;
    IF p_external_listing_id IS NOT NULL
       AND v_ref.external_listing_id IS NOT NULL
       AND v_ref.external_listing_id IS DISTINCT FROM p_external_listing_id THEN
      RAISE EXCEPTION 'referral does not match this listing' USING ERRCODE = '22023';
    END IF;
    IF v_source_id IS NULL THEN v_source_id := v_ref.source_id; END IF;
    IF v_ref.source_id IS NOT NULL AND v_source_id IS DISTINCT FROM v_ref.source_id THEN
      RAISE EXCEPTION 'referral does not match this source' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.marketplace_leads (
    referral_id, source_id, external_listing_id, user_id,
    full_name, email, phone, message, enquiry_type,
    consent_partner_contact, consent_partner_contact_at,
    consent_marketing, consent_marketing_at,
    consent_receipt, status, assigned_to
  ) VALUES (
    p_referral_id, v_source_id, p_external_listing_id, auth.uid(),
    btrim(p_full_name), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''),
    nullif(btrim(p_message), ''), coalesce(nullif(btrim(p_enquiry_type), ''), 'enquiry'),
    true, v_now,
    coalesce(p_consent_marketing, false),
    CASE WHEN coalesce(p_consent_marketing, false) THEN v_now ELSE NULL END,
    jsonb_build_object(
      'recorded_at', v_now,
      'method', 'halisia_web_form',
      'consent_partner_contact', true,
      'consent_marketing', coalesce(p_consent_marketing, false),
      'authenticated', auth.uid() IS NOT NULL
    ),
    'new'::public.mkt_lead_status, NULL
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_create_lead(text, boolean, text, text, text, text, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_create_lead(text, boolean, text, text, text, text, uuid, uuid, boolean) TO anon, authenticated, service_role;

-- 7. Partner lead updates limited to workflow fields ---------------------

CREATE OR REPLACE FUNCTION public.mkt_guard_partner_lead_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'administrator'::public.app_role) THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.phone IS DISTINCT FROM OLD.phone
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.enquiry_type IS DISTINCT FROM OLD.enquiry_type
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.referral_id IS DISTINCT FROM OLD.referral_id
       OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.external_listing_id IS DISTINCT FROM OLD.external_listing_id
       OR NEW.consent_partner_contact IS DISTINCT FROM OLD.consent_partner_contact
       OR NEW.consent_partner_contact_at IS DISTINCT FROM OLD.consent_partner_contact_at
       OR NEW.consent_marketing IS DISTINCT FROM OLD.consent_marketing
       OR NEW.consent_marketing_at IS DISTINCT FROM OLD.consent_marketing_at
       OR NEW.consent_receipt IS DISTINCT FROM OLD.consent_receipt
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'enquiry contact, consent and attribution fields are not editable by partners'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mkt_guard_partner_lead_update ON public.marketplace_leads;
CREATE TRIGGER trg_mkt_guard_partner_lead_update
BEFORE UPDATE ON public.marketplace_leads
FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_partner_lead_update();