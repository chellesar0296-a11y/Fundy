/**
 * reset-campaign.mjs
 * ─────────────────────────────────────────────────────────────
 * Undo simulate-expiry — restore a campaign to 'active' with
 * a fresh end_date in the future.
 *
 * Usage:
 *   node scripts/reset-campaign.mjs <campaign_db_id> [--days=7]
 *
 * --days=7  means new end_date = now + 7 days (default: 7)
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const args         = process.argv.slice(2);
const campaignDbId = args.find(a => !a.startsWith('--'));
const daysArg      = args.find(a => a.startsWith('--days='));
const DAYS         = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

if (!campaignDbId) {
  console.error('\n❌  Usage: node scripts/reset-campaign.mjs <campaign_db_id> [--days=7]\n');
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

async function main() {
  console.log('\n' + '═'.repeat(52));
  console.log('  🔄  Campaign Reset (active + future end_date)');
  console.log('═'.repeat(52));

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('  ❌  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
  const futureDate = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'active', end_date: futureDate })
    .eq('id', campaignDbId)
    .select('id, title, status, end_date')
    .single();

  if (error) {
    console.error('  ❌  Update failed:', error.message);
    process.exit(1);
  }

  console.log(`\n  ✅  "${data.title}" reset!`);
  console.log(`  ℹ️   status   → ${data.status}`);
  console.log(`  ℹ️   end_date → ${data.end_date}`);
  console.log('\n  ⚠️   Note: Ganache block time cannot be reversed.');
  console.log('       Restart Ganache to reset the chain clock.\n');
}

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
});
