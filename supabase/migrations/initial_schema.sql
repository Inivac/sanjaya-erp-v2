-- Initial database schema for Sanyaja Professional Tailors ERP
-- Drop tables if they exist
DROP TABLE IF EXISTS public.business_profile CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create Items table
CREATE TABLE public.items (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  color text NOT NULL,
  material text NOT NULL,
  size text NOT NULL,
  cost integer NOT NULL,
  rent_price integer NOT NULL,
  status text NOT NULL,
  condition text NOT NULL,
  added_on date NOT NULL
);

-- Create Customers table
CREATE TABLE public.customers (
  id text PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  nic text,
  email text,
  phone text NOT NULL,
  phone2 text,
  address text NOT NULL,
  created_on date NOT NULL
);

-- Create Orders table
CREATE TABLE public.orders (
  invoice text PRIMARY KEY,
  customer_id text REFERENCES public.customers(id) ON DELETE CASCADE,
  order_date date NOT NULL,
  items text[] NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_amount integer NOT NULL,
  payment_received integer NOT NULL,
  remaining_payment integer NOT NULL,
  payment_method text NOT NULL,
  status text NOT NULL,
  dry_clean boolean NOT NULL DEFAULT false,
  pickup_mode text NOT NULL,
  remark text
);

-- Create Expenses table
CREATE TABLE public.expenses (
  id text PRIMARY KEY,
  date date NOT NULL,
  category text NOT NULL,
  amount integer NOT NULL,
  paid_by text NOT NULL,
  note text
);

-- Create Users table (linked to auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  last_login text
);

-- Create Business Profile table
CREATE TABLE public.business_profile (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL,
  tagline text,
  reg_no text,
  tax_id text,
  currency text NOT NULL DEFAULT 'LKR',
  phone text,
  email text,
  address text,
  late_fee_per_day integer NOT NULL DEFAULT 500
);

-- Ensure RLS is disabled for simpler dashboard operations (or set open rules)
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profile DISABLE ROW LEVEL SECURITY;
