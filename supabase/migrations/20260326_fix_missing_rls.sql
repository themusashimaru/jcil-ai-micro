-- Enable RLS on tables that were missing it
-- generated_sites contains user data and MUST be protected

ALTER TABLE IF EXISTS public.generated_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.website_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.template_variations ENABLE ROW LEVEL SECURITY;

-- generated_sites: users can only see their own generated sites
CREATE POLICY "Users can view own generated sites"
  ON public.generated_sites FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own generated sites"
  ON public.generated_sites FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own generated sites"
  ON public.generated_sites FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own generated sites"
  ON public.generated_sites FOR DELETE
  USING (auth.uid()::text = user_id);

-- website_templates: public read access (templates are shared content)
CREATE POLICY "Anyone can read website templates"
  ON public.website_templates FOR SELECT
  USING (true);

-- template_variations: public read access
CREATE POLICY "Anyone can read template variations"
  ON public.template_variations FOR SELECT
  USING (true);
