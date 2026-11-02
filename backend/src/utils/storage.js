const { createClient } = require('@supabase/supabase-js');

const BUCKET = process.env.SUPABASE_BUCKET || 'bukti-dukung';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

let _client = null;
let _bucketReady = false;

function getStorage() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diset');
    }
    _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _client.storage;
}

// Buat bucket publik jika belum ada (best-effort)
async function ensureBucket() {
  if (_bucketReady) return;
  const storage = getStorage();
  const { data } = await storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FILE_SIZE });
    if (error && !/already exists/i.test(error.message)) throw error;
    console.log(`🪣 Bucket "${BUCKET}" dibuat`);
  }
  _bucketReady = true;
}

module.exports = { getStorage, ensureBucket, BUCKET, MAX_FILE_SIZE };
