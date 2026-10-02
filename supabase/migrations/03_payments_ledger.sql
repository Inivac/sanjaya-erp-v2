-- Migration: Create payments ledger and backfill existing payment records

CREATE TABLE public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text REFERENCES public.orders(id) ON DELETE CASCADE,
  amount FLOAT NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  payment_type text,
  reference_note text
);

-- Backfill existing orders' payments
INSERT INTO public.payments (order_id, amount, payment_date, payment_method, payment_type)
SELECT 
  id, 
  payment_received, 
  start_date, 
  payment_method, 
  'Advance'
FROM public.orders
WHERE payment_received > 0;
