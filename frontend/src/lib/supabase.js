import { createClient } from '@supabase/supabase-js';

// Supabase configuration (must be provided via env; see frontend/.env.example)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase belum dikonfigurasi. Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di frontend/.env.development atau .env.production (lihat frontend/.env.example).'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
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

export const signUpAdmin = async ({ email, password, displayName }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'admin',
        display_name: displayName || 'Administrator',
      },
    },
  });
  if (error) throw error;
  return data;
};

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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};
