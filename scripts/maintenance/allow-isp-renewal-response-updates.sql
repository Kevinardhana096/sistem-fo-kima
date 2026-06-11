-- Allow mapped ISP users to submit only their renewal response through a controlled RPC.
-- Admin users still use the existing table policies and direct update flow.

CREATE OR REPLACE FUNCTION public.submit_isp_renewal_response(
  p_follow_up_id bigint,
  p_response_file_url text,
  p_response_file_name text,
  p_response_decision text
)
RETURNS public.isp_renewal_follow_ups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_isp_id bigint;
  v_follow_up public.isp_renewal_follow_ups%ROWTYPE;
  v_contract_row public.isp_contract_rows%ROWTYPE;
  v_updated public.isp_renewal_follow_ups%ROWTYPE;
  v_next_period_start date;
  v_next_period_end date;
BEGIN
  v_role := public.get_user_role();
  v_isp_id := public.get_current_user_isp_id();

  IF v_role <> 'isp' OR v_isp_id IS NULL THEN
    RAISE EXCEPTION 'Akun ISP tidak valid untuk mengirim tanggapan perpanjangan.'
      USING ERRCODE = '42501';
  END IF;

  IF p_response_file_url IS NULL OR btrim(p_response_file_url) = '' THEN
    RAISE EXCEPTION 'Berkas tanggapan wajib diunggah.'
      USING ERRCODE = '22023';
  END IF;

  IF p_response_decision NOT IN ('lanjut', 'tidak') THEN
    RAISE EXCEPTION 'Status tanggapan perpanjangan tidak valid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT f.*
  INTO v_follow_up
  FROM public.isp_renewal_follow_ups f
  JOIN public.isp_contract_rows r ON r.id = f.row_id
  WHERE f.id = p_follow_up_id
    AND r.isp_id = v_isp_id
    AND r.deleted_at IS NULL
  FOR UPDATE OF f;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tindak lanjut perpanjangan tidak ditemukan untuk akun ISP ini.'
      USING ERRCODE = '42501';
  END IF;

  IF v_follow_up.renewal_file_url IS NULL OR btrim(v_follow_up.renewal_file_url) = '' THEN
    RAISE EXCEPTION 'Surat perpanjangan belum tersedia untuk ditanggapi.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.isp_renewal_follow_ups
  SET
    status = 'completed',
    response_file_url = p_response_file_url,
    response_file_name = NULLIF(btrim(COALESCE(p_response_file_name, '')), ''),
    response_decision = p_response_decision,
    updated_at = now()
  WHERE id = p_follow_up_id
  RETURNING * INTO v_updated;

  IF p_response_decision = 'lanjut' THEN
    SELECT *
    INTO v_contract_row
    FROM public.isp_contract_rows
    WHERE id = v_updated.row_id;

    IF FOUND
      AND COALESCE(v_contract_row.period_end::text, '') <> ''
      AND lower(COALESCE(v_contract_row.status, v_contract_row.renewal_status, '')) NOT IN ('berhenti', 'nonaktif')
    THEN
      v_next_period_start := v_contract_row.period_end + 1;
      v_next_period_end := (v_next_period_start + interval '1 year' - interval '1 day')::date;

      INSERT INTO public.isp_contract_rows (
        isp_id,
        contract_reference,
        contract_start_date,
        period_start,
        period_end,
        renewal_status,
        status,
        bak_file_url,
        bak_file_name,
        contract_file_url,
        contract_file_name,
        response_file_url,
        response_file_name,
        created_at,
        updated_at
      )
      SELECT
        v_contract_row.isp_id,
        v_contract_row.contract_reference,
        v_contract_row.contract_start_date,
        v_next_period_start,
        v_next_period_end,
        'active',
        'beroperasi',
        v_contract_row.bak_file_url,
        v_contract_row.bak_file_name,
        v_contract_row.contract_file_url,
        v_contract_row.contract_file_name,
        v_updated.response_file_url,
        v_updated.response_file_name,
        now(),
        now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.isp_contract_rows existing
        WHERE existing.isp_id = v_contract_row.isp_id
          AND existing.period_start = v_next_period_start
          AND existing.deleted_at IS NULL
      );
    END IF;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_isp_renewal_response(bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_isp_renewal_response(bigint, text, text, text) TO authenticated;
