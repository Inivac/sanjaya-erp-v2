-- RPC function to fetch accounting page data
CREATE OR REPLACE FUNCTION get_accounting_data(
  p_limit_expenses integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result json;
  v_total_income numeric;
  v_total_expenses numeric;
  v_outstanding numeric;
BEGIN
  -- Calculate total income from orders
  SELECT COALESCE(SUM(payment_received), 0) INTO v_total_income
  FROM orders;

  -- Calculate total expenses
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM expenses;

  -- Calculate outstanding payments from orders
  SELECT COALESCE(SUM(remaining_payment), 0) INTO v_outstanding
  FROM orders
  WHERE remaining_payment > 0;

  SELECT json_build_object(
    'kpis', json_build_object(
      'total_income', v_total_income,
      'total_expenses', v_total_expenses,
      'outstanding', v_outstanding,
      'net_profit', v_total_income - v_total_expenses
    ),

    'expenses_by_category', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          category,
          SUM(amount) AS total
        FROM expenses
        GROUP BY category
        ORDER BY total DESC
      ) t
    ),

    'recent_expenses', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          id,
          date,
          category,
          amount,
          paid_by,
          note
        FROM expenses
        ORDER BY id DESC
        LIMIT p_limit_expenses
      ) t
    ),

    'total_expenses_count', (
      SELECT COUNT(*) FROM expenses
    )

  ) INTO result;

  RETURN result;
END;
$$;
