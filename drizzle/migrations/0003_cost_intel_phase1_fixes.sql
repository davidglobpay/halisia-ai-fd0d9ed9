CREATE TABLE public.boq_labour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typology TEXT NOT NULL,
  structure TEXT NOT NULL CHECK (structure IN ('container_20ft','container_40ft','masonry_stone','masonry_block','precast','eps')),
  finish TEXT NOT NULL CHECK (finish IN ('basic','standard','premium')),
  trade TEXT NOT NULL,
  days NUMERIC NOT NULL CHECK (days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boq_labour TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boq_labour TO authenticated;
GRANT ALL ON public.boq_labour TO service_role;
ALTER TABLE public.boq_labour ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read BoQ labour" ON public.boq_labour FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Administrators can write BoQ labour" ON public.boq_labour FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE INDEX boq_labour_combo ON public.boq_labour (typology, structure, finish);

ALTER TABLE public.land_price_obs ADD COLUMN include_in_median BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.land_price_obs ADD COLUMN quality_note TEXT;
ALTER TABLE public.land_price_obs ADD COLUMN locality TEXT;

ALTER TABLE public.material_price ADD COLUMN price_kes_low NUMERIC CHECK (price_kes_low IS NULL OR price_kes_low > 0);
ALTER TABLE public.material_price ADD COLUMN price_kes_high NUMERIC CHECK (price_kes_high IS NULL OR price_kes_high >= price_kes_low);
ALTER TABLE public.material_price ADD COLUMN use_in_totals BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.material_price ADD COLUMN note TEXT;
ALTER TABLE public.material_price DROP CONSTRAINT material_price_source_type_check;
ALTER TABLE public.material_price ADD CONSTRAINT material_price_source_type_check CHECK (source_type IN ('supplier_list','quote','receipt','published_guide'));

ALTER TABLE public.labour_rate ADD COLUMN rate_kes_high NUMERIC CHECK (rate_kes_high IS NULL OR rate_kes_high >= rate_kes);
ALTER TABLE public.labour_rate ADD COLUMN source_url TEXT;
ALTER TABLE public.labour_rate ADD COLUMN note TEXT;

ALTER TABLE public.boq_template ADD COLUMN quantity_basis TEXT;