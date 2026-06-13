-- Function to create an ISP user account directly from frontend (admin only)
CREATE OR REPLACE FUNCTION public.create_isp_account(
  p_isp_id BIGINT,
  p_email TEXT,
  p_password TEXT,
  p_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  -- 1. Check if current user is admin
  v_role := (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT;
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can create ISP accounts';
  END IF;

  -- 2. Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email % already exists', p_email;
  END IF;

  -- 3. Check if ISP already has an account
  IF EXISTS (SELECT 1 FROM public.isp_user_accounts WHERE isp_id = p_isp_id) THEN
    RAISE EXCEPTION 'ISP already has an account mapped';
  END IF;

  -- 4. Generate UUID
  v_user_id := gen_random_uuid();

  -- 5. Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', 'isp', 'display_name', p_name),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- 6. Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 7. Insert mapping into public.isp_user_accounts
  INSERT INTO public.isp_user_accounts (
    auth_user_id,
    isp_id,
    email,
    display_name
  ) VALUES (
    v_user_id,
    p_isp_id,
    p_email,
    p_name
  );

  -- 8. Sync with public.isps
  UPDATE public.isps 
  SET user_id = p_email, password_plain = p_password 
  WHERE id = p_isp_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users (the function itself checks for admin role)
GRANT EXECUTE ON FUNCTION public.create_isp_account TO authenticated;

