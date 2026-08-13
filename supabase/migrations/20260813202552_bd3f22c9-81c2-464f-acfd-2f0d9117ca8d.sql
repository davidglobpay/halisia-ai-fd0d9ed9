
-- ============ Spatial AR/VR tables ============
CREATE TABLE IF NOT EXISTS public.parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_deed_no text UNIQUE NOT NULL,
  parcel_code text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  county text,
  centroid_lat double precision NOT NULL,
  centroid_lng double precision NOT NULL,
  geometry jsonb NOT NULL,
  area_sqm numeric NOT NULL,
  elevation_masl numeric,
  zoning_type text CHECK (zoning_type IN ('Commercial','Residential','Agricultural','Mixed-Use','Industrial')),
  max_building_height_m numeric DEFAULT 15,
  road_setback_m numeric DEFAULT 6,
  riparian_setback_m numeric DEFAULT 10,
  valuation_kes numeric,
  status text DEFAULT 'verified' CHECK (status IN ('verified','disputed','pending','encumbered')),
  survey_verified_on date,
  deed_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parcels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcels TO authenticated;
GRANT ALL ON public.parcels TO service_role;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcels public read" ON public.parcels FOR SELECT USING (true);
CREATE POLICY "parcels owner write" ON public.parcels FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.parcel_beacons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  beacon_code text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  elevation_m numeric,
  ordinal int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.parcel_beacons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcel_beacons TO authenticated;
GRANT ALL ON public.parcel_beacons TO service_role;
ALTER TABLE public.parcel_beacons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beacons public read" ON public.parcel_beacons FOR SELECT USING (true);
CREATE POLICY "beacons owner write" ON public.parcel_beacons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_id AND p.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.architectural_prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text CHECK (category IN ('Residential Villa','Commercial Plaza','Container Mall','Warehouse','Apartment Block')),
  gltf_url text,
  usdz_url text,
  footprint_sqm numeric,
  height_m numeric DEFAULT 6,
  floors int DEFAULT 1,
  estimated_cost_kes numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.architectural_prototypes TO anon;
GRANT SELECT ON public.architectural_prototypes TO authenticated;
GRANT ALL ON public.architectural_prototypes TO service_role;
ALTER TABLE public.architectural_prototypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prototypes public read" ON public.architectural_prototypes FOR SELECT USING (true);

INSERT INTO public.architectural_prototypes (title, category, footprint_sqm, height_m, floors, estimated_cost_kes) VALUES
 ('Maridadi 4-Bed Villa','Residential Villa',210,7.5,2,18500000),
 ('Sokoni Commercial Plaza','Commercial Plaza',640,18,5,145000000),
 ('Jenga Container Mall','Container Mall',420,6.5,2,32000000),
 ('Ghala Logistics Warehouse','Warehouse',1200,9,1,68000000),
 ('Nyumbani Apartment Block','Apartment Block',480,21,6,210000000);

-- ============ Demo parcels + beacons ============
WITH p AS (
  INSERT INTO public.parcels
    (title_deed_no, parcel_code, county, centroid_lat, centroid_lng, geometry, area_sqm, elevation_masl,
     zoning_type, max_building_height_m, road_setback_m, riparian_setback_m, valuation_kes, status,
     survey_verified_on, deed_hash)
  VALUES
   ('NAIROBI/BLOCK 118/2451','KJD-RUIRU-2451','Kiambu',-1.14840,36.95820,
     '{"type":"Polygon","coordinates":[[[36.95760,-1.14790],[36.95880,-1.14790],[36.95880,-1.14890],[36.95760,-1.14890],[36.95760,-1.14790]]]}'::jsonb,
     1480,1548,'Residential',15,6,10,14500000,'verified','2025-11-04','0x9f2c71ad4be0'),
   ('KAJIADO/KITENGELA/8891','KJD-KIT-8891','Kajiado',-1.47610,36.95300,
     '{"type":"Polygon","coordinates":[[[36.95240,-1.47560],[36.95360,-1.47560],[36.95360,-1.47660],[36.95240,-1.47660],[36.95240,-1.47560]]]}'::jsonb,
     2020,1620,'Mixed-Use',24,9,10,9800000,'verified','2025-08-19','0x71ba03ce88f1'),
   ('MOMBASA/MTWAPA/1204','MSA-MTW-1204','Kilifi',-3.94210,39.74430,
     '{"type":"Polygon","coordinates":[[[39.74370,-3.94160],[39.74490,-3.94160],[39.74490,-3.94260],[39.74370,-3.94260],[39.74370,-3.94160]]]}'::jsonb,
     1650,22,'Commercial',30,9,30,26000000,'pending','2026-01-22','0x33ef90a1c7d2')
  RETURNING id, parcel_code, centroid_lat, centroid_lng
)
INSERT INTO public.parcel_beacons (parcel_id, beacon_code, lat, lng, elevation_m, ordinal)
SELECT p.id, 'BC-0'||g.i,
       p.centroid_lat + (ARRAY[0.00050,0.00050,-0.00050,-0.00050])[g.i],
       p.centroid_lng + (ARRAY[-0.00060,0.00060,0.00060,-0.00060])[g.i],
       NULL, g.i
FROM p, generate_series(1,4) AS g(i);

-- ============ Demo marketplace listings ============
INSERT INTO public.properties
 (owner_id, title, description, kind, intent, status, review_state, price, currency, county, address,
  latitude, longitude, size_value, size_unit, bedrooms, bathrooms, amenities, utilities, featured,
  completeness_pct, submitted_at, cover_image, media_urls)
VALUES
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Ruiru 50x100 Residential Plot — Titled & Beaconed','Fully titled 1/8-acre plot in a gated Ruiru scheme. Tarmac access 400 m, Kenya Power on site, borehole water. Ready-to-build with approved setbacks.','land','sale','published','approved',4950000,'KES','Kiambu','Ruiru, Kiambu County',-1.14840,36.95820,0.125,'acre',NULL,NULL,ARRAY['Perimeter wall','Gated scheme','Borehole'],ARRAY['Electricity','Water','Fibre'],true,92,now(),'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Kitengela 1-Acre Mixed-Use Frontage','Prime one-acre parcel with 40 m frontage on the Namanga highway service road. Suited to retail podium plus residential above under Kajiado mixed-use zoning.','land','sale','published','approved',13500000,'KES','Kajiado','Kitengela, Kajiado County',-1.47610,36.95300,1,'acre',NULL,NULL,ARRAY['Highway frontage','Level terrain'],ARRAY['Electricity','Water'],true,88,now(),'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Karen 4-Bedroom Villa on 0.5 Acre','Elegant family home with mature garden, DSQ, solar hot water and backup borehole. Walking distance to Karen shopping centre.','house','sale','published','approved',68000000,'KES','Nairobi','Karen, Nairobi',-1.31900,36.71200,0.5,'acre',4,4,ARRAY['DSQ','Mature garden','Solar water','Backup generator'],ARRAY['Electricity','Water','Fibre','Sewer'],true,95,now(),'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Kilimani 2-Bedroom Apartment — Furnished','High-floor furnished apartment with balcony views, lift, borehole, and 24/7 security. Service charge KES 9,000/month.','apartment','rent','published','approved',95000,'KES','Nairobi','Kilimani, Nairobi',-1.29060,36.78390,110,'sqm',2,2,ARRAY['Lift','Gym','24/7 security','Parking'],ARRAY['Electricity','Water','Fibre'],false,90,now(),'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Mtwapa Beach-Road Commercial Plot','Commercial parcel 600 m from the beach on Mtwapa creek road. Suited to hospitality or serviced apartments; riparian setback mapped.','commercial','sale','published','approved',26000000,'KES','Kilifi','Mtwapa, Kilifi County',-3.94210,39.74430,0.4,'acre',NULL,NULL,ARRAY['Creek proximity','Tarmac access'],ARRAY['Electricity','Water'],false,84,now(),'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Nakuru Agricultural 5 Acres — Njoro','Fertile red-soil farmland with river frontage and existing greenhouse structure. Ideal for horticulture with year-round irrigation.','agricultural','sale','published','approved',11000000,'KES','Nakuru','Njoro, Nakuru County',-0.33330,35.94000,5,'acre',NULL,NULL,ARRAY['River frontage','Greenhouse','Red soil'],ARRAY['Electricity','Water'],false,80,now(),'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Syokimau 3-Bedroom Maisonette — To Let','Modern maisonette in a gated court, 8 minutes from the SGR terminus. Solar water heating and ample parking.','rental','rent','published','approved',78000,'KES','Machakos','Syokimau, Machakos County',-1.36000,36.94500,180,'sqm',3,3,ARRAY['Gated court','Parking','Playground'],ARRAY['Electricity','Water','Fibre'],false,86,now(),'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Industrial Area Godown — 12,000 sqft','Steel-frame godown with 6 m eaves, loading bay and three-phase power on Enterprise Road. Available on a 6-year lease.','industrial','lease','published','approved',1400000,'KES','Nairobi','Enterprise Road, Nairobi',-1.31500,36.85200,1115,'sqm',NULL,NULL,ARRAY['Loading bay','Three-phase power','Yard space'],ARRAY['Electricity','Water','Sewer'],false,82,now(),'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Naivasha Lakeview 2 Acres','Elevated parcel with uninterrupted Lake Naivasha views. Popular for eco-lodges and weekend homes; geothermal grid nearby.','land','sale','published','approved',18000000,'KES','Nakuru','Naivasha, Nakuru County',-0.71670,36.43100,2,'acre',NULL,NULL,ARRAY['Lake views','Elevated terrain'],ARRAY['Electricity'],false,78,now(),'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=70']),
 ('7f6629f4-7e83-48c1-9c80-fd844d2fbae8','Eldoret Mixed-Use Corner Plot','Corner plot on Kisumu Road with dual frontage, approved for ground-floor retail and four upper residential floors.','mixed_use','sale','published','approved',22000000,'KES','Uasin Gishu','Eldoret, Uasin Gishu County',0.51430,35.26980,0.3,'acre',NULL,NULL,ARRAY['Corner plot','Dual frontage'],ARRAY['Electricity','Water','Sewer','Fibre'],false,83,now(),'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=70',ARRAY['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=70']);
