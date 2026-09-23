-- Migration: 20260902000038_fix_admin_analytics_service_type.sql
-- Fix get_admin_analytics RPC cross-type comparison (text = service_type)
-- Cast service_type to text on both sides of the join in Section 6.

CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role           text;
  v_start                 timestamptz;
  v_end                   timestamptz;
  
  -- Summary metrics (Historical range)
  v_total_orders          bigint;
  v_completed_orders      bigint;
  v_cancelled_orders      bigint;
  v_total_revenue         numeric(14,2);
  v_total_delivery_fees   numeric(14,2);
  
  -- Live operational metrics (Current platform state, unbounded by historical range)
  v_pending_orders        bigint;
  v_active_deliveries     bigint;
  v_unassigned_deliveries bigint;
  v_active_riders         bigint;
  v_available_riders      bigint;
  v_active_vendors        bigint;
  v_pending_rider_apps    bigint;
  v_pending_vendor_apps   bigint;
  v_refund_review_count   bigint;
  
  -- Historical series
  v_orders_over_time      jsonb;
  v_orders_by_service     jsonb;
  v_order_status_dist     jsonb;
  v_delivery_status_dist  jsonb;
  v_completion_trends     jsonb;
BEGIN
  -- 1. Authorization Gate: Only admin, super_admin, or backend service_role may retrieve administrative analytics
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: administrative role required for analytics'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Date Boundary Normalization & Guardrails
  -- Default to past 30 days if boundaries omitted
  v_end := COALESCE(p_end_date, pg_catalog.now());
  v_start := COALESCE(p_start_date, v_end - interval '30 days');

  -- Chronological order check
  IF v_start >= v_end THEN
    RAISE EXCEPTION 'Invalid date range: start date must be strictly before end date'
      USING ERRCODE = 'KD400';
  END IF;

  -- Large range protection: cap custom queries to a maximum of 365 days
  IF (v_end - v_start) > interval '365 days' THEN
    RAISE EXCEPTION 'Invalid date range: query period exceeds maximum allowed range of 365 days'
      USING ERRCODE = 'KD400';
  END IF;

  -- 3. Historical Summary Computations within Half-Open Range [v_start, v_end)
  SELECT 
    count(*),
    count(*) FILTER (WHERE status = 'delivered'),
    count(*) FILTER (WHERE status = 'cancelled'),
    COALESCE(sum(total) FILTER (WHERE status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered')), 0.00),
    COALESCE(sum(delivery_fee) FILTER (WHERE status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered')), 0.00)
  INTO 
    v_total_orders,
    v_completed_orders,
    v_cancelled_orders,
    v_total_revenue,
    v_total_delivery_fees
  FROM public.orders
  WHERE created_at >= v_start AND created_at < v_end;

  -- 4. Live Operational Metrics (Current Platform State, Unbounded)
  -- 4.1 Pending Orders (awaiting merchant preparation or confirmation)
  SELECT count(*) INTO v_pending_orders
  FROM public.orders
  WHERE status IN ('pending', 'payment_pending', 'payment_confirmed');

  -- 4.2 Active In-Flight Deliveries
  SELECT count(*) INTO v_active_deliveries
  FROM public.deliveries
  WHERE status IN ('assigned', 'picked_up', 'in_transit');

  -- 4.3 Unassigned Deliveries (Paid and awaiting courier dispatch)
  SELECT count(*) INTO v_unassigned_deliveries
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id
  WHERE d.status = 'pending'
    AND o.status IN ('payment_confirmed', 'preparing', 'ready_for_pickup');

  -- 4.4 Active & Available Fleet Riders
  SELECT 
    count(*) FILTER (WHERE is_active = true),
    count(*) FILTER (WHERE is_active = true AND is_available = true)
  INTO 
    v_active_riders,
    v_available_riders
  FROM public.riders;

  -- 4.5 Active Vendors
  SELECT count(*) INTO v_active_vendors
  FROM public.vendors
  WHERE is_active = true;

  -- 4.6 Pending Onboarding Applications
  SELECT count(*) INTO v_pending_rider_apps
  FROM public.rider_applications
  WHERE status = 'pending';

  SELECT count(*) INTO v_pending_vendor_apps
  FROM public.vendor_applications
  WHERE status = 'pending';

  -- 4.7 Orders Flagged for Refund Review
  SELECT count(*) INTO v_refund_review_count
  FROM public.orders
  WHERE refund_required = true 
    AND refund_status = 'pending_manual_review';

  -- 5. Orders Over Time (Grouped by Africa/Lagos Calendar Day within Range)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'count', COALESCE(o.cnt, 0),
    'total_orders', COALESCE(o.cnt, 0),
    'completed_orders', COALESCE(o.completed_cnt, 0),
    'cancelled_orders', COALESCE(o.cancelled_cnt, 0),
    'total_amount', COALESCE(o.total_sum, 0.00),
    'total_revenue', COALESCE(o.total_sum, 0.00)
  ) ORDER BY d.day ASC), '[]'::jsonb)
  INTO v_orders_over_time
  FROM (
    SELECT generate_series(
      date_trunc('day', timezone('Africa/Lagos', v_start)),
      date_trunc('day', timezone('Africa/Lagos', v_end - interval '1 millisecond')),
      interval '1 day'
    )::date AS day
  ) d
  LEFT JOIN (
    SELECT 
      date_trunc('day', timezone('Africa/Lagos', created_at))::date AS day,
      count(*) AS cnt,
      count(*) FILTER (WHERE status = 'delivered') AS completed_cnt,
      count(*) FILTER (WHERE status = 'cancelled') AS cancelled_cnt,
      COALESCE(sum(total) FILTER (WHERE status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered')), 0.00) AS total_sum
    FROM public.orders
    WHERE created_at >= v_start AND created_at < v_end
    GROUP BY 1
  ) o ON o.day = d.day;

  -- 6. Orders by Service Type (ROBUST CROSS-TYPE EQUALITY: Cast both to ::text)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'service_type', s.service_type,
    'count', COALESCE(cnt, 0),
    'order_count', COALESCE(cnt, 0),
    'total_revenue', COALESCE(rev, 0.00),
    'percentage', CASE 
      WHEN v_total_orders > 0 THEN round((COALESCE(cnt, 0)::numeric / v_total_orders::numeric) * 100.0, 1)
      ELSE 0.0
    END
  )), '[]'::jsonb)
  INTO v_orders_by_service
  FROM (
    SELECT unnest(enum_range(NULL::public.service_type))::text AS service_type
  ) s
  LEFT JOIN (
    SELECT 
      service_type::text AS service_type, 
      count(*) AS cnt,
      COALESCE(sum(total) FILTER (WHERE status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered')), 0.00) AS rev
    FROM public.orders
    WHERE created_at >= v_start AND created_at < v_end
    GROUP BY service_type::text
  ) o ON o.service_type = s.service_type;

  -- 7. Order Status Distribution (For orders created within period)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', s.status,
    'count', COALESCE(cnt, 0),
    'percentage', CASE 
      WHEN v_total_orders > 0 THEN round((COALESCE(cnt, 0)::numeric / v_total_orders::numeric) * 100.0, 1)
      ELSE 0.0
    END
  )), '[]'::jsonb)
  INTO v_order_status_dist
  FROM (
    SELECT unnest(enum_range(NULL::public.order_status)) AS status
  ) s
  LEFT JOIN (
    SELECT status, count(*) AS cnt
    FROM public.orders
    WHERE created_at >= v_start AND created_at < v_end
    GROUP BY status
  ) o ON o.status = s.status;

  -- 8. Delivery Status Distribution (For deliveries created within period)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', s.status,
    'count', COALESCE(cnt, 0),
    'percentage', CASE 
      WHEN v_del_total > 0 THEN round((COALESCE(cnt, 0)::numeric / v_del_total::numeric) * 100.0, 1)
      ELSE 0.0
    END
  )), '[]'::jsonb)
  INTO v_delivery_status_dist
  FROM (
    SELECT unnest(enum_range(NULL::public.delivery_status)) AS status
  ) s
  CROSS JOIN (
    SELECT count(*) AS v_del_total 
    FROM public.deliveries 
    WHERE created_at >= v_start AND created_at < v_end
  ) tot
  LEFT JOIN (
    SELECT status, count(*) AS cnt
    FROM public.deliveries
    WHERE created_at >= v_start AND created_at < v_end
    GROUP BY status
  ) d ON d.status = s.status;

  -- 9. Completion Trends (Grouped strictly by Authoritative delivered_at and cancelled_at Timestamps)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'completed', COALESCE(c.completed_cnt, 0),
    'cancelled', COALESCE(x.cancelled_cnt, 0)
  ) ORDER BY d.day ASC), '[]'::jsonb)
  INTO v_completion_trends
  FROM (
    SELECT generate_series(
      date_trunc('day', timezone('Africa/Lagos', v_start)),
      date_trunc('day', timezone('Africa/Lagos', v_end - interval '1 millisecond')),
      interval '1 day'
    )::date AS day
  ) d
  LEFT JOIN (
    SELECT 
      date_trunc('day', timezone('Africa/Lagos', delivered_at))::date AS day,
      count(*) AS completed_cnt
    FROM public.orders
    WHERE status = 'delivered'
      AND delivered_at IS NOT NULL
      AND delivered_at >= v_start 
      AND delivered_at < v_end
    GROUP BY 1
  ) c ON c.day = d.day
  LEFT JOIN (
    SELECT 
      date_trunc('day', timezone('Africa/Lagos', cancelled_at))::date AS day,
      count(*) AS cancelled_cnt
    FROM public.orders
    WHERE status = 'cancelled'
      AND cancelled_at IS NOT NULL
      AND cancelled_at >= v_start 
      AND cancelled_at < v_end
    GROUP BY 1
  ) x ON x.day = d.day;

  -- 10. Assemble and Return Authoritative Analytics Payload
  RETURN jsonb_build_object(
    'date_range', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end,
      'timezone', 'Africa/Lagos'
    ),
    'summary', jsonb_build_object(
      'total_orders', v_total_orders,
      'completed_orders', v_completed_orders,
      'cancelled_orders', v_cancelled_orders,
      'total_revenue', v_total_revenue,
      'total_delivery_fees', v_total_delivery_fees,
      'active_riders_count', v_active_riders,
      'active_vendors_count', v_active_vendors,
      'pending_rider_applications', v_pending_rider_apps,
      'pending_vendor_applications', v_pending_vendor_apps,
      'refund_review_count', v_refund_review_count
    ),
    'live_metrics', jsonb_build_object(
      'pending_orders_live', v_pending_orders,
      'active_deliveries_live', v_active_deliveries,
      'unassigned_deliveries_live', v_unassigned_deliveries,
      'available_riders_live', v_available_riders,
      'active_riders_live', v_active_riders,
      'active_vendors_live', v_active_vendors
    ),
    'orders_over_time', v_orders_over_time,
    'orders_by_service', v_orders_by_service,
    'order_status_distribution', v_order_status_dist,
    'delivery_status_distribution', v_delivery_status_dist,
    'completion_trends', v_completion_trends
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz) TO authenticated, service_role;
