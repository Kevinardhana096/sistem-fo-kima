-- Script to check and fix stale/out-of-sync invoices for historical contract versions.
-- Includes a dry-run checking query and a PL/pgSQL repair routine to reconcile data.

-- 1. Helper function to generate expected invoice periods based on date ranges and billing cycle
CREATE OR REPLACE FUNCTION public.get_expected_invoice_periods(
  p_start_date date,
  p_end_date date,
  p_every int,
  p_unit text
)
RETURNS TABLE (
  period_start_date date,
  period_end_date date
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cursor date;
  v_next_cursor date;
  v_calculated_end date;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_every IS NULL OR p_every <= 0 OR p_unit IS NULL THEN
    RETURN;
  END IF;

  IF p_start_date > p_end_date THEN
    RETURN;
  END IF;

  v_cursor := p_start_date;
  WHILE v_cursor <= p_end_date LOOP
    IF p_unit = 'tahun' THEN
      v_next_cursor := (v_cursor + (p_every || ' years')::interval)::date;
    ELSIF p_unit = 'bulan' THEN
      v_next_cursor := (v_cursor + (p_every || ' months')::interval)::date;
    ELSIF p_unit = 'hari' THEN
      v_next_cursor := (v_cursor + (p_every || ' days')::interval)::date;
    ELSE
      v_next_cursor := (v_cursor + interval '1 month')::date;
    END IF;

    IF v_next_cursor IS NULL OR v_next_cursor <= v_cursor THEN
      EXIT;
    END IF;

    v_calculated_end := (v_next_cursor - interval '1 day')::date;
    IF v_calculated_end < p_end_date THEN
      period_end_date := v_calculated_end;
    ELSE
      period_end_date := p_end_date;
    END IF;

    period_start_date := v_cursor;
    RETURN NEXT;

    v_cursor := v_next_cursor;
  END LOOP;
END;
$$;


-- 2. PL/pgSQL repair routine to scan and reconcile out-of-sync invoice records
CREATE OR REPLACE FUNCTION public.fix_out_of_sync_invoices(p_dry_run boolean DEFAULT true)
RETURNS TABLE (
  contract_version_id bigint,
  contract_number text,
  status text,
  message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cv RECORD;
  v_ep RECORD;
  v_inv RECORD;
  v_billing_every int;
  v_billing_unit text;
  v_monthly_amount numeric;
  v_invoice_amount numeric;
  v_now timestamp;
  
  -- arrays and cursors for matching
  v_expected_starts date[];
  v_expected_ends date[];
  v_expected_matched boolean[];
  v_actual_ids bigint[];
  v_actual_starts date[];
  v_actual_ends date[];
  v_actual_matched boolean[];
  v_first_actual_status invoice_schedule_status;
  
  v_i int;
  v_j int;
  v_expected_len int;
  v_actual_len int;
  
  v_matched_idx int;
  v_updated_count int := 0;
  v_created_count int := 0;
  v_deleted_count int := 0;
  v_skipped_count int := 0;
  
  v_has_settlement boolean;
  v_due_date date;
  v_schedule_status invoice_schedule_status;
BEGIN
  v_now := now();
  
  -- Loop through all active contract versions
  FOR v_cv IN
    SELECT cv.id, cv.contract_id, cv.contract_number, cv.start_date, cv.end_date, cv.monthly_amount, cv.customer_id
    FROM public.contract_versions cv
    WHERE cv.deleted_at IS NULL
  LOOP
    -- Get contract billing cycle
    SELECT coalesce(c.billing_every, 1), coalesce(c.billing_unit, 'bulan')
    INTO v_billing_every, v_billing_unit
    FROM public.contracts c
    WHERE c.id = v_cv.contract_id;
    
    -- Gather expected periods
    v_expected_starts := array[]::date[];
    v_expected_ends := array[]::date[];
    v_expected_matched := array[]::boolean[];
    
    FOR v_ep IN
      SELECT period_start_date, period_end_date
      FROM public.get_expected_invoice_periods(v_cv.start_date, v_cv.end_date, v_billing_every, v_billing_unit)
      ORDER BY period_start_date
    LOOP
      v_expected_starts := array_append(v_expected_starts, v_ep.period_start_date);
      v_expected_ends := array_append(v_expected_ends, v_ep.period_end_date);
      v_expected_matched := array_append(v_expected_matched, false);
    END LOOP;
    
    v_expected_len := coalesce(array_length(v_expected_starts, 1), 0);
    
    -- Gather existing invoices
    v_actual_ids := array[]::bigint[];
    v_actual_starts := array[]::date[];
    v_actual_ends := array[]::date[];
    v_actual_matched := array[]::boolean[];
    v_first_actual_status := NULL;
    
    FOR v_inv IN
      SELECT i.id, i.period_start_date, i.period_end_date, i.schedule_status
      FROM public.invoices i
      WHERE i.contract_version_id = v_cv.id
        AND i.deleted_at IS NULL
      ORDER BY i.period_start_date, i.id
    LOOP
      v_actual_ids := array_append(v_actual_ids, v_inv.id);
      v_actual_starts := array_append(v_actual_starts, v_inv.period_start_date);
      v_actual_ends := array_append(v_actual_ends, v_inv.period_end_date);
      v_actual_matched := array_append(v_actual_matched, false);
      IF v_first_actual_status IS NULL AND v_inv.schedule_status IS NOT NULL THEN
        v_first_actual_status := v_inv.schedule_status;
      END IF;
    END LOOP;
    
    v_actual_len := coalesce(array_length(v_actual_ids, 1), 0);
    
    -- If both are empty, nothing to do
    IF v_expected_len = 0 AND v_actual_len = 0 THEN
      CONTINUE;
    END IF;
    
    -- Determine default schedule status
    IF v_first_actual_status IS NOT NULL THEN
      v_schedule_status := v_first_actual_status;
    ELSIF v_cv.end_date < v_now::date THEN
      v_schedule_status := 'history'::invoice_schedule_status;
    ELSE
      v_schedule_status := 'active'::invoice_schedule_status;
    END IF;
    
    -- Resolve billing amount
    v_monthly_amount := coalesce(v_cv.monthly_amount, 0);
    IF v_billing_unit = 'tahun' THEN
      v_invoice_amount := v_monthly_amount * v_billing_every * 12;
    ELSIF v_billing_unit = 'bulan' THEN
      v_invoice_amount := v_monthly_amount * v_billing_every;
    ELSIF v_billing_unit = 'hari' THEN
      v_invoice_amount := round((v_monthly_amount / 30.0) * v_billing_every);
    ELSE
      v_invoice_amount := v_monthly_amount;
    END IF;
    
    v_updated_count := 0;
    v_created_count := 0;
    v_deleted_count := 0;
    v_skipped_count := 0;
    
    -- Phase 1: Match identical periods
    IF v_expected_len > 0 AND v_actual_len > 0 THEN
      FOR v_i IN 1..v_expected_len LOOP
        FOR v_j IN 1..v_actual_len LOOP
          IF NOT v_actual_matched[v_j] AND v_actual_starts[v_j] = v_expected_starts[v_i] AND v_actual_ends[v_j] = v_expected_ends[v_i] THEN
            v_expected_matched[v_i] := true;
            v_actual_matched[v_j] := true;
            
            IF NOT p_dry_run THEN
              UPDATE public.invoices
              SET
                contract_number = v_cv.contract_number,
                schedule_status = coalesce(schedule_status, v_schedule_status),
                updated_at = v_now
              WHERE id = v_actual_ids[v_j];
            END IF;
            v_updated_count := v_updated_count + 1;
            EXIT;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
    
    -- Phase 2: Reuse remaining actual invoices sequentially for unmatched expected periods
    IF v_expected_len > 0 AND v_actual_len > 0 THEN
      FOR v_i IN 1..v_expected_len LOOP
        IF NOT v_expected_matched[v_i] THEN
          v_matched_idx := -1;
          FOR v_j IN 1..v_actual_len LOOP
            IF NOT v_actual_matched[v_j] THEN
              v_matched_idx := v_j;
              EXIT;
            END IF;
          END LOOP;
          
          IF v_matched_idx <> -1 THEN
            v_expected_matched[v_i] := true;
            v_actual_matched[v_matched_idx] := true;
            
            IF NOT p_dry_run THEN
              IF extract(day from v_expected_starts[v_i]) >= 16 THEN
                v_due_date := (date_trunc('month', v_expected_starts[v_i]) + interval '1 month')::date;
              ELSE
                v_due_date := (date_trunc('month', v_expected_starts[v_i]))::date;
              END IF;
              
              UPDATE public.invoices
              SET
                contract_number = v_cv.contract_number,
                period_start_date = v_expected_starts[v_i],
                period_end_date = v_expected_ends[v_i],
                period_year = extract(year from v_expected_starts[v_i])::smallint,
                period_month = extract(month from v_expected_starts[v_i])::smallint,
                due_date = v_due_date,
                schedule_status = coalesce(schedule_status, v_schedule_status),
                updated_at = v_now
              WHERE id = v_actual_ids[v_matched_idx];
            END IF;
            v_updated_count := v_updated_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- Phase 3: Create missing invoices
    IF v_expected_len > 0 THEN
      FOR v_i IN 1..v_expected_len LOOP
        IF NOT v_expected_matched[v_i] THEN
          IF NOT p_dry_run THEN
            IF extract(day from v_expected_starts[v_i]) >= 16 THEN
              v_due_date := (date_trunc('month', v_expected_starts[v_i]) + interval '1 month')::date;
            ELSE
              v_due_date := (date_trunc('month', v_expected_starts[v_i]))::date;
            END IF;
            
            INSERT INTO public.invoices (
              customer_id,
              contract_id,
              contract_version_id,
              contract_number,
              period_start_date,
              period_end_date,
              period_year,
              period_month,
              due_date,
              schedule_status,
              amount,
              status,
              updated_at,
              created_at
            ) VALUES (
              v_cv.customer_id,
              v_cv.contract_id,
              v_cv.id,
              v_cv.contract_number,
              v_expected_starts[v_i],
              v_expected_ends[v_i],
              extract(year from v_expected_starts[v_i])::smallint,
              extract(month from v_expected_starts[v_i])::smallint,
              v_due_date,
              v_schedule_status,
              v_invoice_amount,
              'belum_ditagih',
              v_now,
              v_now
            );
          END IF;
          v_created_count := v_created_count + 1;
        END IF;
      END LOOP;
    END IF;
    
    -- Phase 4: Remove/Soft-delete excess invoices
    IF v_actual_len > 0 THEN
      FOR v_j IN 1..v_actual_len LOOP
        IF NOT v_actual_matched[v_j] THEN
          SELECT EXISTS (
            SELECT 1 FROM public.invoices inv
            WHERE inv.id = v_actual_ids[v_j]
              AND (
                inv.status = 'lunas'
                OR inv.paid_at IS NOT NULL
                OR inv.invoice_file_url IS NOT NULL
                OR inv.payment_proof_file_url IS NOT NULL
                OR inv.document_id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM public.invoice_follow_ups fu
                  WHERE fu.invoice_id = inv.id
                )
              )
          ) INTO v_has_settlement;
          
          IF v_has_settlement THEN
            v_skipped_count := v_skipped_count + 1;
          ELSE
            IF NOT p_dry_run THEN
              UPDATE public.invoices
              SET
                deleted_at = v_now,
                updated_at = v_now
              WHERE id = v_actual_ids[v_j];
            END IF;
            v_deleted_count := v_deleted_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- Record reporting entries
    IF v_updated_count > 0 OR v_created_count > 0 OR v_deleted_count > 0 OR v_skipped_count > 0 THEN
      contract_version_id := v_cv.id;
      contract_number := v_cv.contract_number;
      IF p_dry_run THEN
        status := 'OUT_OF_SYNC';
        message := format('Perlu rekonsiliasi: update=%s, insert=%s, delete=%s, skip_lunas=%s', v_updated_count, v_created_count, v_deleted_count, v_skipped_count);
      ELSE
        status := 'RECONCILED';
        message := format('Berhasil direkonsiliasi: update=%s, insert=%s, delete=%s, skip_lunas=%s', v_updated_count, v_created_count, v_deleted_count, v_skipped_count);
      END IF;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 3. Sample usage query to check out-of-sync invoices (dry-run):
-- SELECT * FROM public.fix_out_of_sync_invoices(p_dry_run => true);

-- 4. Sample usage query to apply the reconciliation repairs:
-- SELECT * FROM public.fix_out_of_sync_invoices(p_dry_run => false);
