/**
 * simulate-expiry.mjs
 * ─────────────────────────────────────────────────────────────
 * Dev-only script to simulate campaign expiry for refund testing.
 *
 * Usage:
 *   node scripts/simulate-expiry.mjs <campaign_db_id> [--days=7]
 *
 * Examples:
 *   node scripts/simulate-expiry.mjs abc-123-uuid
 *   node scripts/simulate-expiry.mjs abc-123-uuid --days=30
 *   node scripts/simulate-expiry.mjs abc-123-uuid --skip-chain
 *   node scripts/simulate-expiry.mjs abc-123-uuid --skip-db
 *
 * Requirements (install if missing):
 *   npm install ethers @supabase/supabase-js dotenv
 * ─────────────────────────────────────────────────────────────
 */

import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config(); // loads .env / .env.local

// ── 0. Parse CLI args ─────────────────────────────────────────
const args = process.argv.slice(2);
const campaignDbId = args.find(a => !a.startsWith('--'));
const daysArg      = args.find(a => a.startsWith('--days='));
const skipChain    = args.includes('--skip-chain');
const skipDb       = args.includes('--skip-db');
const DAYS         = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

if (!campaignDbId) {
  console.error('\n❌  Usage: node scripts/simulate-expiry.mjs <campaign_db_id> [--days=7]\n');
  process.exit(1);
}

// ── 1. Config — reads from your existing .env ─────────────────
const GANACHE_RPC   = process.env.VITE_GANACHE_RPC_URL   || 'http://127.0.0.1:7545';
const CONTRACT_ADDR = process.env.VITE_CONTRACT_ADDRESS   || process.env.VITE_CROWDFUNDING_ADDRESS;
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.VITE_SUPABASE_ANON_KEY  || process.env.VITE_SUPABASE_SERVICE_KEY;

// ── 2. Minimal ABI — only what we need ───────────────────────
const MINIMAL_ABI = [
  'function getCampaign(uint256) returns (tuple(string supabaseId, address organizer, ..., bool cancelled, ...))'
];

// ── 3. Pretty logging helpers ─────────────────────────────────
const log  = (msg)       => console.log(`\n  ${msg}`);
const ok   = (msg)       => console.log(`  ✅ ${msg}`);
const fail = (msg)       => console.log(`  ❌ ${msg}`);
const info = (msg)       => console.log(`  ℹ️  ${msg}`);
const sep  = ()          => console.log('  ' + '─'.repeat(52));

// ─────────────────────────────────────────────────────────────
//  STEP A — Ganache: fast-forward time
// ─────────────────────────────────────────────────────────────
async function fastForwardGanache(days) {
  sep();
  log(`⛓  GANACHE — fast-forward +${days} days`);
  sep();

  const provider = new ethers.JsonRpcProvider(GANACHE_RPC);

  // Verify connection
  try {
    const network = await provider.getNetwork();
    ok(`Connected → chain id ${network.chainId}  (${GANACHE_RPC})`);
  } catch {
    fail(`Cannot connect to Ganache at ${GANACHE_RPC}`);
    info('Is Ganache running?  Check VITE_GANACHE_RPC_URL in your .env');
    return false;
  }

  const beforeBlock  = await provider.getBlock('latest');
  const beforeTime   = new Date(Number(beforeBlock.timestamp) * 1000);
  info(`Block timestamp BEFORE: ${beforeTime.toLocaleString()}`);

  // Fast-forward
  const seconds = days * 24 * 60 * 60;
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine',         []);

  const afterBlock = await provider.getBlock('latest');
  const afterTime  = new Date(Number(afterBlock.timestamp) * 1000);
  ok(`Block timestamp AFTER:  ${afterTime.toLocaleString()}`);
  ok(`Jumped ${days} days (${seconds.toLocaleString()} seconds)`);

  // Optionally verify on-chain campaign deadline if contract address provided
  if (CONTRACT_ADDR) {
    try {
      // We need the on_chain_id from DB to query the contract
      // We'll look it up below; for now just confirm contract is reachable
      const code = await provider.getCode(CONTRACT_ADDR);
      if (code === '0x') {
        fail(`No contract found at ${CONTRACT_ADDR}`);
      } else {
        ok(`Contract reachable at ${CONTRACT_ADDR}`);
      }
    } catch {
      info('Could not verify contract — skipping contract check');
    }
  } else {
    info('VITE_CONTRACT_ADDRESS not set — skipping on-chain campaign check');
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
//  STEP B — Supabase: update campaign to expired
// ─────────────────────────────────────────────────────────────
async function expireCampaignInDb(campaignId, days) {
  sep();
  log(`🗄️  SUPABASE — expire campaign ${campaignId}`);
  sep();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    fail('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // First fetch the current record so we can show a diff
  const { data: before, error: fetchErr } = await supabase
    .from('campaigns')
    .select('id, title, status, end_date, on_chain_id, current_amount, goal_amount')
    .eq('id', campaignId)
    .single();

  if (fetchErr || !before) {
    fail(`Campaign not found: ${fetchErr?.message ?? 'no row returned'}`);
    return null;
  }

  info(`Found: "${before.title}"`);
  info(`Status: ${before.status}  |  end_date: ${before.end_date}`);
  info(`Raised: ${before.current_amount} / ${before.goal_amount}`);
  if (before.on_chain_id !== null) info(`on_chain_id: ${before.on_chain_id}`);

  // Set end_date to [days] days ago and status to expired
  const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabase
    .from('campaigns')
    .update({
      status:   'expired',
      end_date: pastDate,
    })
    .eq('id', campaignId);

  if (updateErr) {
    fail(`Update failed: ${updateErr.message}`);
    return null;
  }

  ok(`status   → "expired"`);
  ok(`end_date → ${pastDate}`);
  return before; // return original for on-chain check later
}

// ─────────────────────────────────────────────────────────────
//  STEP C — Verify on-chain campaign state (optional)
// ─────────────────────────────────────────────────────────────
async function verifyOnChainState(onChainId) {
  if (!CONTRACT_ADDR || onChainId === null || onChainId === undefined) return;

  sep();
  log(`🔍  VERIFY — on-chain campaign #${onChainId}`);
  sep();

  try {
    const provider = new ethers.JsonRpcProvider(GANACHE_RPC);
    const contract = new ethers.Contract(CONTRACT_ADDR, MINIMAL_ABI, provider);
    const c        = await contract.getCampaign(onChainId);

    const deadline    = new Date(Number(c.deadline) * 1000);
    const now         = new Date();
    const isExpired   = now > deadline;
    const raised      = ethers.formatEther(c.totalRaisedEth);
    const goal        = ethers.formatEther(c.goalAmount);
    const goalReached = BigInt(c.totalRaisedEth) + BigInt(c.totalRaisedFdy) >= BigInt(c.goalAmount);

    info(`Deadline:     ${deadline.toLocaleString()}`);
    info(`Now:          ${now.toLocaleString()}`);
    info(`Raised:       ${raised} ETH  /  goal ${goal} ETH`);
    info(`Goal reached: ${goalReached}`);
    info(`Withdrawn:    ${c.withdrawn}`);

    if (isExpired && !goalReached) {
      ok('✔ Campaign IS expired on-chain AND goal not reached → REFUNDS ENABLED');
    } else if (isExpired && goalReached) {
      info('Campaign expired but goal WAS reached → organizer can withdraw, no refunds');
    } else {
      info('Campaign not yet expired on-chain — did evm_increaseTime run?');
    }
  } catch (err) {
    fail(`On-chain verify failed: ${err.message}`);
    info('ABI mismatch? Update MINIMAL_ABI in this script to match your contract.');
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(56));
  console.log('  🧪  Campaign Expiry Simulator  (dev only)');
  console.log('═'.repeat(56));
  info(`Campaign DB ID : ${campaignDbId}`);
  info(`Days to jump   : ${DAYS}`);
  info(`Skip chain     : ${skipChain}`);
  info(`Skip DB        : ${skipDb}`);

  let dbRecord = null;

  // A) Supabase
  if (!skipDb) {
    dbRecord = await expireCampaignInDb(campaignDbId, DAYS);
  }

  // B) Ganache
  if (!skipChain) {
    await fastForwardGanache(DAYS);
  }

  // C) Verify
  const onChainId = dbRecord?.on_chain_id ?? null;
  if (!skipChain && onChainId !== null) {
    await verifyOnChainState(onChainId);
  }

  sep();
  console.log('\n  🎉  Done! Next steps:');
  console.log('     1. Reload http://localhost:8081/');
  console.log('     2. Open the campaign page — status should show "Expired"');
  console.log('     3. Donors can now click "Claim Refund"\n');
}

main().catch(err => {
  console.error('\n❌  Unhandled error:', err.message);
  process.exit(1);
});
