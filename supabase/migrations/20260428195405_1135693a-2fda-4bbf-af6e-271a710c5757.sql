
-- Wardrobe items table
CREATE TABLE public.wardrobe_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | analysed | failed
  verdict TEXT, -- keep | dump | gap
  reason TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own items" ON public.wardrobe_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own items" ON public.wardrobe_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own items" ON public.wardrobe_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own items" ON public.wardrobe_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_wardrobe_items_updated_at
  BEFORE UPDATE ON public.wardrobe_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wardrobe_items_user_created ON public.wardrobe_items(user_id, created_at DESC);

-- Private storage bucket for wardrobe photos
INSERT INTO storage.buckets (id, name, public) VALUES ('wardrobe', 'wardrobe', false);

CREATE POLICY "Users read own wardrobe photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wardrobe' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own wardrobe photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wardrobe' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own wardrobe photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'wardrobe' AND auth.uid()::text = (storage.foldername(name))[1]);
