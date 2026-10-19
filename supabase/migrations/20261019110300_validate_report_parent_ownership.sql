BEGIN;
ALTER POLICY "owner manages shares" ON public.report_shares WITH CHECK (
 auth.uid()=owner_id AND EXISTS(SELECT 1 FROM public.saved_items s WHERE s.id=saved_item_id AND s.user_id=auth.uid())
);
ALTER POLICY "owner writes versions" ON public.report_versions WITH CHECK (
 auth.uid()=owner_id AND EXISTS(SELECT 1 FROM public.saved_items s WHERE s.id=saved_item_id AND s.user_id=auth.uid())
);
COMMIT;
