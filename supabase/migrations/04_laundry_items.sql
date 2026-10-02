-- Migration: Granular item-level laundry tracking

CREATE TABLE public.laundry_items (
  id serial PRIMARY KEY,
  order_id text REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id integer REFERENCES public.items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz DEFAULT now()
);

-- Backfill legacy order-level laundry tracking into granular item rows
WITH extracted_items AS (
  SELECT 
    d.order_id, 
    i.item_id,
    o.dryclean_status
  FROM public.order_details d
  JOIN public.orders o ON o.id = d.order_id
  CROSS JOIN LATERAL unnest(ARRAY[
    NULLIF(d.coat::text, ''), 
    NULLIF(d.trouser::text, ''), 
    NULLIF(d.west::text, ''), 
    NULLIF(d.national::text, '')
  ]) AS i(item_id)
  WHERE o.is_dryclean = true AND i.item_id IS NOT NULL
)
INSERT INTO public.laundry_items (order_id, item_id, status)
SELECT 
  order_id, 
  item_id::integer, 
  COALESCE(dryclean_status, 'Pending') 
FROM extracted_items
ON CONFLICT DO NOTHING;
