import { createClient } from '@supabase/supabase-js';
import api from './frontend/src/lib/api.js';

async function test() {
  console.log("Starting test...");
  console.time("fetch");
  try {
    const data = await api.notifications.list({ limit: 200, includeResolved: true });
    console.log("Loaded", data?.length, "items");
  } catch(e) {
    console.error(e);
  }
  console.timeEnd("fetch");
}
test();
