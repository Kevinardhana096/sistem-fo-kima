const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("=== Memulai Skenario Pengujian Notifikasi Email ===");
  
  let dummyIspId = null;
  let userData = null;

  try {
    // 1. Injeksi Data Dummy (Create Customer)
    console.log("1. Membuat data Customer dummy...");
    const { data: ispData, error: ispError } = await supabase
      .from('customers')
      .insert({
        name: 'Customer Uji Coba Otomatis',
        customer_code: 'TEST-' + Math.floor(Math.random() * 1000),
        isp_name: 'Dummy ISP',
        status: 'aktif',
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (ispError) throw ispError;
    dummyIspId = ispData.id;
    console.log(`   Berhasil membuat Customer dummy dengan ID: ${dummyIspId}`);

    // 1.5 Membuat dummy user untuk bypass Auth Edge Function
    console.log("1.5 Membuat dummy user admin...");
    const dummyEmail = 'dummy_admin_test@kima.co.id';
    const { data: userCreatedData, error: userError } = await supabase.auth.admin.createUser({
      email: dummyEmail,
      password: 'password123',
      email_confirm: true,
      user_metadata: { role: 'admin', display_name: 'Admin Tester' }
    });
    if (userError && !userError.message.includes('already exists')) throw userError;
    userData = userCreatedData;

    // Login as dummy user to get session token
    const anonSupabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
    const { data: signInData, error: signInError } = await anonSupabase.auth.signInWithPassword({
      email: dummyEmail,
      password: 'password123'
    });
    if (signInError) throw signInError;

    const sessionToken = signInData.session.access_token;

    // 2. Memicu Pengiriman Email via Edge Function
    console.log("2. Memanggil Edge Function 'send-notification-emails'...");
    const { data: funcData, error: funcError } = await anonSupabase.functions.invoke('send-notification-emails', {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      },
      body: {
        trigger: 'entity_saved',
        entityType: 'customer',
        entityId: dummyIspId,
        recipientEmail: 'kevinardana12@gmail.com',
        limit: 10
      }
    });

    if (funcError) {
      console.error("   Gagal memanggil Edge Function:", funcError.message);
      if (funcError.context) {
        try {
           const body = await funcError.context.json();
           console.error("   Error body:", body);
        } catch(e) {}
      }
    } else {
      console.log("   Edge Function berhasil dipanggil. Response:", JSON.stringify(funcData));
    }

    // 3. Verifikasi Keberhasilan di Tabel notification_email_deliveries
    console.log("3. Mengecek riwayat pengiriman email di tabel 'notification_email_deliveries'...");
    // Beri sedikit waktu untuk memastikan database menyimpan record
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: deliveries, error: delivError } = await supabase
      .from('notification_email_deliveries')
      .select('notification_key, recipient_email, status, provider_message_id, provider, error_message')
      .like('notification_key', `%-${dummyIspId}`);

    if (delivError) throw delivError;

    if (deliveries && deliveries.length > 0) {
      console.log(`   Ditemukan ${deliveries.length} antrean notifikasi untuk Customer dummy ini:`);
      deliveries.forEach(d => {
        console.log(`   - Key: ${d.notification_key} | To: ${d.recipient_email} | Status: ${d.status} | Provider: ${d.provider} | MessageID: ${d.provider_message_id} | Error: ${d.error_message}`);
      });
      console.log("   => KESIMPULAN: Pengecekan Provider selesai.");
    } else {
      console.log("   Tidak ada notifikasi yang ditemukan untuk Customer dummy ini.");
      console.log("   => KESIMPULAN: Mekanisme mungkin gagal atau tidak ada penerima valid.");
    }

  } catch (error) {
    console.error("Terjadi kesalahan selama pengujian:", error);
  } finally {
    // 4. Pembersihan Data (Cleanup)
    if (dummyIspId) {
      console.log("4. Melakukan pembersihan (cleanup) data Customer dummy...");
      
      // Hapus delivery records (hard delete spy bersih)
      await supabase.from('notification_email_deliveries').delete().like('notification_key', `%-${dummyIspId}`);
      
      // Hard delete Customer dummy
      const { error: deleteError } = await supabase.from('customers').delete().eq('id', dummyIspId);
      if (deleteError) {
        console.error("   Gagal menghapus Customer dummy:", deleteError.message);
      } else {
        console.log("   Berhasil menghapus Customer dummy.");
      }
      
      // Delete dummy user
      if (userData?.user?.id) {
         await supabase.auth.admin.deleteUser(userData.user.id);
         console.log("   Berhasil menghapus admin dummy.");
      }
    }
    console.log("=== Pengujian Selesai ===");
  }
}

runTest();
