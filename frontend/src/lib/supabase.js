import { createClient } from '@supabase/supabase-js';

// Supabase configuration (must be provided via env; see frontend/.env.example)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;
const SUPABASE_SAFE_RETRY_ATTEMPTS = 3;
const SUPABASE_RETRY_DELAYS_MS = [700, 1_500];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di frontend/.env.development atau .env.production (lihat frontend/.env.example).'
  );
}

const supabaseStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRequestMethod = (input, init = {}) => (
  init.method
  || (typeof Request !== 'undefined' && input instanceof Request ? input.method : '')
  || 'GET'
).toUpperCase();

const isRetryableMethod = (method) => method === 'GET' || method === 'HEAD';

const isRetryableStatus = (status) => [408, 429, 500, 502, 503, 504].includes(Number(status));

const createTimeoutError = (cause) => {
  const error = new Error('Koneksi ke server terlalu lama merespons. Silakan coba lagi.');
  error.name = 'SupabaseTimeoutError';
  error.code = 'REQUEST_TIMEOUT';
  error.cause = cause;
  return error;
};

export const isNetworkError = (error) => {
  if (!error) return false;

  const text = [
    error.name,
    error.message,
    error.code,
    error.status,
    error.cause?.name,
    error.cause?.message,
  ].filter(Boolean).join(' ').toLowerCase();

  return error.code === 'REQUEST_TIMEOUT'
    || error.name === 'SupabaseTimeoutError'
    || error.name === 'AbortError'
    || text.includes('failed to fetch')
    || text.includes('networkerror')
    || text.includes('network request failed')
    || text.includes('load failed')
    || text.includes('timeout')
    || text.includes('timed out')
    || text.includes('offline')
    || text.includes('connection');
};

const fetchWithTimeout = async (input, init = {}) => {
  const controller = new AbortController();
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  const abortFromCaller = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) {
      abortFromCaller();
    } else {
      init.signal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) throw createTimeoutError(error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener?.('abort', abortFromCaller);
  }
};

const resilientFetch = async (input, init = {}) => {
  const method = getRequestMethod(input, init);
  const maxAttempts = isRetryableMethod(method) ? SUPABASE_SAFE_RETRY_ATTEMPTS : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init);
      if (attempt < maxAttempts && isRetryableStatus(response.status)) {
        await sleep(SUPABASE_RETRY_DELAYS_MS[attempt - 1] ?? SUPABASE_RETRY_DELAYS_MS.at(-1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isNetworkError(error)) {
        throw error;
      }
      await sleep(SUPABASE_RETRY_DELAYS_MS[attempt - 1] ?? SUPABASE_RETRY_DELAYS_MS.at(-1));
    }
  }

  throw lastError;
};

export const getStoredSessionSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(supabaseStorageKey);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    const session = parsedValue?.currentSession ?? parsedValue?.session ?? parsedValue;
    return session?.user ? session : null;
  } catch {
    return null;
  }
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: supabaseStorageKey,
  },
  global: {
    fetch: resilientFetch,
  }
});

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper function to sign in
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

const SIGNUP_ROLE_DEFAULT_NAMES = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  teknisi: 'Teknisi',
};

export const signUpInternalUser = async ({ email, password, displayName, role = 'admin' }) => {
  const normalizedRole = Object.hasOwn(SIGNUP_ROLE_DEFAULT_NAMES, role) ? role : 'admin';
  const defaultDisplayName = SIGNUP_ROLE_DEFAULT_NAMES[normalizedRole];

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: normalizedRole,
        display_name: displayName || defaultDisplayName,
      },
    },
  });
  if (error) throw error;
  return data;
};

export const sendInitialNotificationEmails = async ({
  recipientUserId,
  recipientEmail,
  accessToken,
  limit = 100,
}) => {
  const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;

  if (!token) {
    throw new Error('Sesi akun baru belum tersedia untuk memicu email notifikasi.');
  }

  const { data, error } = await supabase.functions.invoke('send-notification-emails', {
    body: {
      trigger: 'register',
      recipientUserId,
      recipientEmail,
      limit,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};


export const sendSavedEntityNotificationEmails = async ({
  entityType,
  entityId,
  limit = 25,
}) => {
  const normalizedEntityType = String(entityType || '').trim().toLowerCase();
  const numericEntityId = Number(entityId);

  if (!['customer', 'isp'].includes(normalizedEntityType) || !Number.isFinite(numericEntityId) || numericEntityId <= 0) {
    throw new Error('Target notifikasi tidak valid.');
  }

  const token = (await supabase.auth.getSession()).data.session?.access_token;

  if (!token) {
    throw new Error('Sesi tidak tersedia untuk memicu email notifikasi.');
  }

  const { data, error } = await supabase.functions.invoke('send-notification-emails', {
    body: {
      trigger: 'entity_saved',
      entityType: normalizedEntityType,
      entityId: numericEntityId,
      limit,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const signUpAdmin = async ({ email, password, displayName }) => (
  signUpInternalUser({ email, password, displayName, role: 'admin' })
);

export const updateCurrentUserProfile = async ({ displayName, password, currentPassword, email }) => {
  const trimmedDisplayName = String(displayName ?? '').trim();

  if (password) {
    if (!email) {
      throw new Error('Email user tidak tersedia untuk verifikasi password.');
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) throw verifyError;
  }

  const updates = {
    data: {
      display_name: trimmedDisplayName,
    },
  };

  if (password) {
    updates.password = password;
  }

  const { data, error } = await supabase.auth.updateUser(updates);
  if (error) throw error;
  return data;
};

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};
