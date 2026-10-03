-- RPC function to fetch orders with customer data
CREATE OR REPLACE FUNCTION get_orders_with_customer(
  p_search text DEFAULT null,
  p_status_id text DEFAULT null,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 10
)
RETURNS TABLE (
  id text,
  invoice_number text,
  customer_id text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  customer_address text,
  start_date date,
  end_date date,
  sub_total numeric,
  payment_received numeric,
  remaining_payment numeric,
  payment_method text,
  status text,
  is_dryclean boolean,
  remark text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.invoice_number,
    o.customer_id,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    c.phone as customer_phone,
    c.address as customer_address,
    o.start_date,
    o.end_date,
    o.sub_total,
    o.payment_received,
    o.remaining_payment,
    o.payment_method,
    o.status,
    o.is_dryclean,
    o.remark,
    o.created_at
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  WHERE 
    (p_search IS NULL OR o.invoice_number ILIKE '%' || p_search || '%')
    AND (p_status_id IS NULL OR o.status = p_status_id)
  ORDER BY o.id DESC
  LIMIT p_per_page OFFSET ((p_page - 1) * p_per_page);
END;
$$;

-- RPC function to fetch orders with customer data for dashboard (date range)
CREATE OR REPLACE FUNCTION get_orders_for_dashboard(
  p_start_date date DEFAULT null,
  p_end_date date DEFAULT null
)
RETURNS TABLE (
  id text,
  invoice_number text,
  customer_id text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  customer_address text,
  start_date date,
  end_date date,
  sub_total numeric,
  payment_received numeric,
  remaining_payment numeric,
  payment_method text,
  status text,
  is_dryclean boolean,
  remark text,
  created_at timestamptz,
  order_details_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.invoice_number,
    o.customer_id,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    c.phone as customer_phone,
    c.address as customer_address,
    o.start_date,
    o.end_date,
    o.sub_total,
    o.payment_received,
    o.remaining_payment,
    o.payment_method,
    o.status,
    o.is_dryclean,
    o.remark,
    o.created_at,
    (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.id) as order_details_count
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  WHERE 
    (p_start_date IS NULL OR o.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at::date <= p_end_date)
  ORDER BY o.created_at DESC;
END;
$$;

-- RPC function to fetch due returns with customer data
CREATE OR REPLACE FUNCTION get_due_returns_with_customer(
  p_end_date date,
  p_search text DEFAULT null,
  p_excluded_status_id text DEFAULT null,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 10
)
RETURNS TABLE (
  id text,
  invoice_number text,
  customer_id text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  customer_address text,
  start_date date,
  end_date date,
  sub_total numeric,
  payment_received numeric,
  remaining_payment numeric,
  payment_method text,
  status text,
  is_dryclean boolean,
  remark text,
  created_at timestamptz,
  order_details json
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.invoice_number,
    o.customer_id,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    c.phone as customer_phone,
    c.address as customer_address,
    o.start_date,
    o.end_date,
    o.sub_total,
    o.payment_received,
    o.remaining_payment,
    o.payment_method,
    o.status,
    o.is_dryclean,
    o.remark,
    o.created_at,
    (
      SELECT json_agg(json_build_object(
        'id', od.id,
        'order_id', od.order_id,
        'coat', od.coat,
        'trouser', od.trouser,
        'west', od.west,
        'national', od.national,
        'rent_or_sale_price', od.rent_or_sale_price
      ))
      FROM order_details od
      WHERE od.order_id = o.id
    ) as order_details
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  WHERE 
    o.end_date <= p_end_date
    AND (p_excluded_status_id IS NULL OR o.status != p_excluded_status_id)
    AND (p_search IS NULL OR o.invoice_number ILIKE '%' || p_search || '%')
  ORDER BY o.end_date ASC
  LIMIT p_per_page OFFSET ((p_page - 1) * p_per_page);
END;
$$;

-- RPC function to fetch single order with customer and details
CREATE OR REPLACE FUNCTION get_order_with_details(p_order_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', o.id,
    'invoice_number', o.invoice_number,
    'customer_id', o.customer_id,
    'customer', json_build_object(
      'id', c.id,
      'first_name', c.first_name,
      'last_name', c.last_name,
      'nic', c.nic,
      'email', c.email,
      'phone', c.phone,
      'phone2', c.phone2,
      'address', c.address
    ),
    'start_date', o.start_date,
    'end_date', o.end_date,
    'sub_total', o.sub_total,
    'payment_received', o.payment_received,
    'remaining_payment', o.remaining_payment,
    'payment_method', o.payment_method,
    'status', o.status,
    'is_dryclean', o.is_dryclean,
    'remark', o.remark,
    'created_at', o.created_at,
    'order_details', (
      SELECT json_agg(json_build_object(
        'id', d.id,
        'order_id', d.order_id,
        'coat', d.coat,
        'trouser', d.trouser,
        'west', d.west,
        'national', d.national,
        'rent_or_sale_price', d.rent_or_sale_price
      ))
      FROM order_details d
      WHERE d.order_id = o.id
    )
  ) INTO result
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  WHERE o.id = p_order_id;
  
  RETURN result;
END;
$$;

-- RPC function to fetch dashboard data
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_limit_orders integer DEFAULT 10,
  p_limit_due_today integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result json;
  v_days_diff integer := p_end_date - p_start_date;
  v_last_month_end date := (p_start_date - INTERVAL '1 day')::date;
  v_last_month_start date := (p_start_date - (v_days_diff + 1) * INTERVAL '1 day')::date;
  v_revenue_total numeric;
  v_revenue_last_month numeric;
BEGIN
  -- Revenue this month vs last month (for the % change KPI)
  SELECT COALESCE(SUM(payment_received), 0) INTO v_revenue_total
  FROM orders
  WHERE created_at::date >= p_start_date AND created_at::date <= p_end_date;

  SELECT COALESCE(SUM(payment_received), 0) INTO v_revenue_last_month
  FROM orders
  WHERE created_at::date >= v_last_month_start AND created_at::date <= v_last_month_end;

  SELECT json_build_object(

    'kpis', json_build_object(
      'revenue_total', v_revenue_total,
      'revenue_mtd_change_pct',
        CASE WHEN v_revenue_last_month > 0
          THEN round(((v_revenue_total - v_revenue_last_month) / v_revenue_last_month) * 100, 1)
          ELSE NULL
        END,

      'active_rentals', (
        SELECT COUNT(*) FROM orders o
        LEFT JOIN order_status os ON os.id = o.status
        WHERE os.name ILIKE ANY (ARRAY['%progress%','%active%','%use%','%rented%'])
          AND o.end_date >= CURRENT_DATE
      ),

      'due_back_today_count', (
        SELECT COUNT(*) FROM orders o
        LEFT JOIN order_status os ON os.id = o.status
        WHERE o.end_date = CURRENT_DATE
          AND (os.name IS NULL OR os.name NOT ILIKE ANY (ARRAY['%return%','%complete%','%cancel%']))
      ),

      'outstanding_payments', (
        SELECT COALESCE(SUM(remaining_payment), 0) FROM orders 
        WHERE remaining_payment > 0 
          AND created_at::date >= p_start_date AND created_at::date <= p_end_date
      ),
      'outstanding_invoices_count', (
        SELECT COUNT(*) FROM orders 
        WHERE remaining_payment > 0 
          AND created_at::date >= p_start_date AND created_at::date <= p_end_date
      ),

      'overdue_returns', (
        SELECT COUNT(*) FROM laundry_items l
        JOIN orders o ON l.order_id = o.id
        WHERE o.is_dryclean = true
      )
    ),

    'revenue_vs_expenses', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          gs.day::date AS day,
          COALESCE(rev.total, 0) AS revenue,
          COALESCE(exp.total, 0) AS expenses
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') gs(day)
        LEFT JOIN (
          SELECT created_at::date AS day, SUM(payment_received) AS total
          FROM orders
          WHERE created_at::date >= p_start_date AND created_at::date <= p_end_date
          GROUP BY created_at::date
        ) rev ON rev.day = gs.day::date
        LEFT JOIN (
          SELECT date AS day, SUM(amount) AS total
          FROM expenses
          WHERE date >= p_start_date AND date <= p_end_date
          GROUP BY date
        ) exp ON exp.day = gs.day::date
      ) d
    ),

    'orders_by_status', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          COALESCE(os.name, 'Unknown') AS status,
          COUNT(*) AS count
        FROM orders o
        LEFT JOIN order_status os ON os.id = o.status
        WHERE o.created_at::date >= p_start_date AND o.created_at::date <= p_end_date
        GROUP BY os.name
        ORDER BY count DESC
      ) t
    ),

    'recent_orders', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          o.id,
          o.invoice_number,
          o.customer_id,
          c.first_name AS customer_first_name,
          c.last_name AS customer_last_name,
          c.phone AS customer_phone,
          o.start_date,
          o.end_date,
          o.sub_total,
          o.payment_received,
          o.remaining_payment,
          o.status,
          os.name AS status_name,
          o.created_at
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id AND c.deleted_at IS NULL
        LEFT JOIN order_status os ON os.id = o.status
        ORDER BY o.created_at DESC
        LIMIT p_limit_orders
      ) t
    ),

    'due_back_today', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          o.id,
          o.invoice_number,
          c.first_name AS customer_first_name,
          c.last_name AS customer_last_name,
          (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.id) AS item_count
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id AND c.deleted_at IS NULL
        WHERE o.end_date = CURRENT_DATE
        ORDER BY o.created_at DESC
        LIMIT p_limit_due_today
      ) t
    )

  ) INTO result;

  RETURN result;
END;
$$;