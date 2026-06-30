-- RPC to update a contract version and reconcile invoices atomically in a single transaction.
-- This ensures that no half-finished updates are saved if any error or constraint violation occurs.

CREATE OR REPLACE FUNCTION public.reconcile_contract_version_and_invoices(
  p_version_id bigint,
  p_version_payload jsonb,
  p_is_latest boolean,
  p_contract_payload jsonb,
  p_invoice_updates jsonb, -- array of { id, contract_number, period_start_date, period_end_date, period_year, period_month, due_date, schedule_status }
  p_invoice_creates jsonb, -- array of invoice row payloads
  p_invoice_removals bigint[] -- array of invoice IDs to soft delete
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_actor_id uuid;
  v_updated_version jsonb;
  v_invoice_update_item jsonb;
  v_invoice_create_item jsonb;
  v_now timestamp;
  v_count_protected int;
BEGIN
  -- 1. Check if caller is admin
  v_role := public.get_user_role();
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat mengubah versi kontrak dan melakukan rekonsiliasi invoice.'
      USING ERRCODE = '42501';
  END IF;

  v_actor_id := auth.uid();
  v_now := now();

  -- 2. Double check that none of the removals have protected settlement data
  IF p_invoice_removals IS NOT NULL AND array_length(p_invoice_removals, 1) > 0 THEN
    SELECT count(*)
    INTO v_count_protected
    FROM public.invoices
    WHERE id = ANY(p_invoice_removals)
      AND (
        status = 'lunas'
        OR paid_at IS NOT NULL
        OR invoice_file_url IS NOT NULL
        OR payment_proof_file_url IS NOT NULL
        OR document_id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.invoice_follow_ups
          WHERE invoice_id = public.invoices.id
        )
      );

    IF v_count_protected > 0 THEN
      RAISE EXCEPTION 'Periode tidak dapat dipendekkan karena % invoice di luar periode sudah memiliki data settlement.', v_count_protected
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Update contract_version
  UPDATE public.contract_versions
  SET
    start_date = CASE WHEN p_version_payload ? 'start_date' THEN (p_version_payload->>'start_date')::date ELSE start_date END,
    end_date = CASE WHEN p_version_payload ? 'end_date' THEN (p_version_payload->>'end_date')::date ELSE end_date END,
    contract_number = CASE WHEN p_version_payload ? 'contract_number' THEN p_version_payload->>'contract_number' ELSE contract_number END,
    version_number = CASE WHEN p_version_payload ? 'version_number' THEN (p_version_payload->>'version_number')::int ELSE version_number END,
    core_type = CASE WHEN p_version_payload ? 'core_type' THEN (p_version_payload->>'core_type')::core_allocation_type ELSE core_type END,
    core_total = CASE WHEN p_version_payload ? 'core_total' THEN (p_version_payload->>'core_total')::int ELSE core_total END,
    shared_core_ratio = CASE WHEN p_version_payload ? 'shared_core_ratio' THEN p_version_payload->>'shared_core_ratio' ELSE shared_core_ratio END,
    bak_document_id = CASE WHEN p_version_payload ? 'bak_document_id' THEN (p_version_payload->>'bak_document_id')::bigint ELSE bak_document_id END,
    renewal_file_url = CASE WHEN p_version_payload ? 'renewal_file_url' THEN p_version_payload->>'renewal_file_url' ELSE renewal_file_url END,
    renewal_file_name = CASE WHEN p_version_payload ? 'renewal_file_name' THEN p_version_payload->>'renewal_file_name' ELSE renewal_file_name END,
    response_file_url = CASE WHEN p_version_payload ? 'response_file_url' THEN p_version_payload->>'response_file_url' ELSE response_file_url END,
    response_file_name = CASE WHEN p_version_payload ? 'response_file_name' THEN p_version_payload->>'response_file_name' ELSE response_file_name END,
    monthly_amount = CASE WHEN p_version_payload ? 'monthly_amount' THEN (p_version_payload->>'monthly_amount')::numeric ELSE monthly_amount END,
    yearly_amount = CASE WHEN p_version_payload ? 'yearly_amount' THEN (p_version_payload->>'yearly_amount')::numeric ELSE yearly_amount END,
    remarks = CASE WHEN p_version_payload ? 'remarks' THEN p_version_payload->>'remarks' ELSE remarks END,
    updated_at = v_now
  WHERE id = p_version_id;

  -- 4. If latest version, update the contracts table
  IF p_is_latest AND p_contract_payload IS NOT NULL THEN
    UPDATE public.contracts
    SET
      end_date = CASE WHEN p_contract_payload ? 'end_date' THEN (p_contract_payload->>'end_date')::date ELSE end_date END,
      contract_number = CASE WHEN p_contract_payload ? 'contract_number' THEN p_contract_payload->>'contract_number' ELSE contract_number END,
      updated_at = v_now
    WHERE id = (SELECT contract_id FROM public.contract_versions WHERE id = p_version_id);
  END IF;

  -- 5. Process invoice updates
  IF p_invoice_updates IS NOT NULL AND jsonb_array_length(p_invoice_updates) > 0 THEN
    FOR v_invoice_update_item IN SELECT * FROM jsonb_array_elements(p_invoice_updates) LOOP
      UPDATE public.invoices
      SET
        contract_number = COALESCE(v_invoice_update_item->>'contract_number', contract_number),
        period_start_date = COALESCE((v_invoice_update_item->>'period_start_date')::date, period_start_date),
        period_end_date = COALESCE((v_invoice_update_item->>'period_end_date')::date, period_end_date),
        period_year = COALESCE((v_invoice_update_item->>'period_year')::smallint, period_year),
        period_month = COALESCE((v_invoice_update_item->>'period_month')::smallint, period_month),
        due_date = COALESCE((v_invoice_update_item->>'due_date')::date, due_date),
        schedule_status = COALESCE((v_invoice_update_item->>'schedule_status')::invoice_schedule_status, schedule_status),
        updated_at = v_now
      WHERE id = (v_invoice_update_item->>'id')::bigint;
    END LOOP;
  END IF;

  -- 6. Process invoice creates
  IF p_invoice_creates IS NOT NULL AND jsonb_array_length(p_invoice_creates) > 0 THEN
    FOR v_invoice_create_item IN SELECT * FROM jsonb_array_elements(p_invoice_creates) LOOP
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
        (v_invoice_create_item->>'customer_id')::bigint,
        (v_invoice_create_item->>'contract_id')::bigint,
        (v_invoice_create_item->>'contract_version_id')::bigint,
        v_invoice_create_item->>'contract_number',
        (v_invoice_create_item->>'period_start_date')::date,
        (v_invoice_create_item->>'period_end_date')::date,
        (v_invoice_create_item->>'period_year')::smallint,
        (v_invoice_create_item->>'period_month')::smallint,
        (v_invoice_create_item->>'due_date')::date,
        (v_invoice_create_item->>'schedule_status')::invoice_schedule_status,
        (v_invoice_create_item->>'amount')::numeric,
        COALESCE((v_invoice_create_item->>'status')::invoice_status, 'belum_ditagih'::invoice_status),
        v_now,
        v_now
      );
    END LOOP;
  END IF;

  -- 7. Process invoice removals
  IF p_invoice_removals IS NOT NULL AND array_length(p_invoice_removals, 1) > 0 THEN
    UPDATE public.invoices
    SET
      deleted_at = v_now,
      deleted_by = v_actor_id,
      updated_at = v_now
    WHERE id = ANY(p_invoice_removals);
  END IF;

  -- 8. Get and return the updated contract version row
  SELECT row_to_json(cv)::jsonb INTO v_updated_version
  FROM public.contract_versions cv
  WHERE cv.id = p_version_id;

  RETURN v_updated_version;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_contract_version_and_invoices(bigint, jsonb, boolean, jsonb, jsonb, jsonb, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_contract_version_and_invoices(bigint, jsonb, boolean, jsonb, jsonb, jsonb, bigint[]) TO authenticated;
