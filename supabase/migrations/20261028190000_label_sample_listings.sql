-- Label the demonstration content seeded on 2026-08-13
-- (migration 20260813202552, section "Demo marketplace listings").
--
-- Those 10 listings are published and approved and make specific claims
-- ("Titled & Beaconed", "approved for ground-floor retail"); the 3 parcels
-- carry invented title numbers, zoning and valuations. Nothing told a visitor
-- they were examples. This flags them so the app can say so. Nothing is
-- deleted or unpublished, and the change is reversible:
--   update public.properties set is_sample = false where is_sample;
--   update public.parcels set is_sample = false where is_sample;
--
-- Safe to run more than once.

alter table public.properties add column if not exists is_sample boolean not null default false;
alter table public.parcels add column if not exists is_sample boolean not null default false;

comment on column public.properties.is_sample is
  'Demonstration listing. Shown with a "Sample listing" label; not a real offer.';
comment on column public.parcels.is_sample is
  'Demonstration parcel with illustrative title number, zoning and valuation.';

update public.properties
set is_sample = true
where id in (
  '0f66c9b5-8674-4e84-b7b6-445f36e00a8c', '4d065ca8-5a7a-4e19-83d1-57259cf2b069',
  'fb5ada26-255d-4659-a069-a039e40f016a', 'c6742406-048e-423f-94d2-ad7b1dde45de',
  'dfb1029c-8e86-4493-aee4-8cd048eb9f2e', '957daba4-442d-4c4a-b12f-672c2ad7c9c3',
  'f718900d-8069-433e-8b9d-cb935daff299', 'a4f64b7b-860d-47b9-91df-4a573af797ff',
  'd299c668-f558-4c4a-8952-723c08be8ea8', 'a23c16fe-c5d0-4b29-8b0c-bf4bcbeda239'
);

update public.parcels
set is_sample = true
where id in (
  '400ff987-2db5-46a7-868d-ddbdf56a5661', '2a5f960d-62fe-4c42-90be-60c2dffdaca5',
  '9d291dbb-fe64-4392-a8d2-214dc030d091'
);
