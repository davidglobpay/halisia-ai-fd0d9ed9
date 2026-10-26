CREATE TABLE public.land_price_obs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  sub_county TEXT,
  ward TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  plot_size_sqft NUMERIC NOT NULL CHECK (plot_size_sqft > 0),
  price_kes NUMERIC NOT NULL CHECK (price_kes > 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('index','listing','user_report','agent')),
  source_name TEXT,
  source_url TEXT,
  observed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.land_price_obs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_price_obs TO authenticated;
GRANT ALL ON public.land_price_obs TO service_role;
ALTER TABLE public.land_price_obs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read land price observations" ON public.land_price_obs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Administrators can write land price observations" ON public.land_price_obs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE INDEX land_price_obs_area_date ON public.land_price_obs (county, sub_county, ward, observed_date DESC);

CREATE TABLE public.material_price (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT,
  price_kes NUMERIC NOT NULL CHECK (price_kes > 0),
  supplier TEXT,
  county TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('supplier_list','quote','receipt')),
  source_url TEXT,
  observed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.material_price TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_price TO authenticated;
GRANT ALL ON public.material_price TO service_role;
ALTER TABLE public.material_price ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read material prices" ON public.material_price FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Administrators can write material prices" ON public.material_price FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE INDEX material_price_item_county_date ON public.material_price (item_code, county, observed_date DESC);

CREATE TABLE public.boq_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typology TEXT NOT NULL,
  structure TEXT NOT NULL CHECK (structure IN ('container_20ft','container_40ft','masonry_stone','masonry_block','precast','eps')),
  finish TEXT NOT NULL CHECK (finish IN ('basic','standard','premium')),
  floor_area_m2 NUMERIC NOT NULL CHECK (floor_area_m2 > 0),
  item_code TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boq_template TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boq_template TO authenticated;
GRANT ALL ON public.boq_template TO service_role;
ALTER TABLE public.boq_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read BoQ templates" ON public.boq_template FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Administrators can write BoQ templates" ON public.boq_template FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE INDEX boq_template_combo ON public.boq_template (typology, structure, finish);

CREATE TABLE public.labour_rate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  unit TEXT NOT NULL,
  rate_kes NUMERIC NOT NULL CHECK (rate_kes > 0),
  county TEXT,
  source TEXT,
  observed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.labour_rate TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_rate TO authenticated;
GRANT ALL ON public.labour_rate TO service_role;
ALTER TABLE public.labour_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read labour rates" ON public.labour_rate FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Administrators can write labour rates" ON public.labour_rate FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE INDEX labour_rate_trade_county_date ON public.labour_rate (trade, county, observed_date DESC);