-- Function to create or update an ISP user account directly from frontend (admin only)
CREATE OR REPLACE FUNCTION public.upsert_isp_account(
  p_isp_id BIGINT,
  p_email TEXT,
  p_password TEXT,
  p_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_existing_auth_id UUID;
BEGIN
  -- 1. Check if current user is admin
  v_role := (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT;
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can manage ISP accounts';
  END IF;

  -- 2. Check if ISP already has an account mapped
  SELECT auth_user_id INTO v_existing_auth_id 
  FROM public.isp_user_accounts 
  WHERE isp_id = p_isp_id;

  IF v_existing_auth_id IS NOT NULL THEN
    -- UPDATE existing account
    UPDATE auth.users 
    SET 
      email = p_email,
      encrypted_password = COALESCE(
        CASE WHEN p_password IS NOT NULL AND p_password != '' THEN crypt(p_password, gen_salt('bf')) ELSE NULL END,
        encrypted_password
      ),
      raw_user_meta_data = jsonb_set(raw_user_meta_data, '{display_name}', to_jsonb(p_name)),
      updated_at = NOW()
    WHERE id = v_existing_auth_id;

    -- Update identity
    UPDATE auth.identities
    SET identity_data = jsonb_build_object('sub', v_existing_auth_id, 'email', p_email)
    WHERE user_id = v_existing_auth_id AND provider = 'email';

    -- Update mapping
    UPDATE public.isp_user_accounts
    SET email = p_email, display_name = p_name
    WHERE isp_id = p_isp_id;

    -- Sync with public.isps
    UPDATE public.isps 
    SET user_id = p_email, 
        password_plain = COALESCE(CASE WHEN p_password IS NOT NULL AND p_password != '' THEN p_password ELSE NULL END, password_plain)
    WHERE id = p_isp_id;

    RETURN v_existing_auth_id;

  ELSE
    -- Check if email already exists in auth.users for another account
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
      RAISE EXCEPTION 'Email % already exists', p_email;
    END IF;

    IF p_password IS NULL OR p_password = '' THEN
      RAISE EXCEPTION 'Password is required for new accounts';
    END IF;

    -- Generate UUID
    v_user_id := gen_random_uuid();

    -- Insert into auth.users
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

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', p_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Insert mapping into public.isp_user_accounts
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

    -- Sync with public.isps
    UPDATE public.isps 
    SET user_id = p_email, password_plain = p_password 
    WHERE id = p_isp_id;

    RETURN v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users (the function itself checks for admin role)
GRANT EXECUTE ON FUNCTION public.upsert_isp_account TO authenticated;