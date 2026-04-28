import { useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';
import { CONTRACT_ADDRESSES, CROWDFUNDING_ABI } from '@/context/Web3Context';

interface UseRefundNotificationsOptions {
    userId: string | null;
    address: string | null;
    provider: ethers.BrowserProvider | null;
}

// Helper to invoke the send-email edge function (matching your pattern)
async function sendEmail(to: string, subject: string, html: string) {
    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: { to, subject, html },
        });
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[sendEmail] failed:', err);
        // Email failures are non-fatal
    }
}

// Email builder for goal reached notification
function buildGoalReachedEmail(campaignTitle: string, campaignUrl: string, imageUrl?: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎉 Goal Reached!</h1>
           </td>
         </tr>
        ${imageUrl ? `<tr><td><img src="${imageUrl}" alt="${campaignTitle}" style="width:100%;height:200px;object-fit:cover;display:block;" /></td></tr>` : ''}
        <tr>
          <td style="padding:36px 40px;">
            <div style="display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;margin-bottom:20px;letter-spacing:0.5px;text-transform:uppercase;">
              Funding Goal Achieved
            </div>
            <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:700;line-height:1.3;">Congratulations! 🎊</h2>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              Your campaign <strong style="color:#111827;">"${campaignTitle}"</strong> has successfully reached its funding goal!
            </p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6;">
              The funds are now available for withdrawal. You can withdraw them directly to your connected wallet.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:12px;background:#111827;">
                  <a href="${campaignUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;">
                    Withdraw Funds →
                  </a>
                 </td>
               </tr>
             </table>
           </td>
         </tr>
         <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              You received this because you are the organizer of this Fundy campaign.<br>
              <a href="${campaignUrl}" style="color:#6b7280;">View Campaign Dashboard</a>
            </p>
           </td>
         </tr>
       </table>
     </td>
   </tr>
</table>
</body>
</html>`.trim();
}

// Email builder for expired campaign notification
function buildCampaignExpiredEmail(campaignTitle: string, goalReached: boolean, campaignUrl: string, imageUrl?: string): string {
    const title = goalReached ? "Campaign Ended - Funds Available" : "Campaign Ended Without Goal";
    const message = goalReached
        ? "Your campaign has ended and successfully reached its funding goal! You can now withdraw the funds."
        : "Your campaign has ended without reaching its goal. Donors can now claim their refunds.";
    const buttonText = goalReached ? "Withdraw Funds →" : "View Campaign →";
    const buttonBg = goalReached ? "#111827" : "#4b5563";

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">📢 Campaign Update</h1>
           </td>
         </tr>
        ${imageUrl ? `<tr><td><img src="${imageUrl}" alt="${campaignTitle}" style="width:100%;height:200px;object-fit:cover;display:block;" /></td></tr>` : ''}
        <tr>
          <td style="padding:36px 40px;">
            <div style="display:inline-block;background:#fed7aa;color:#92400e;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;margin-bottom:20px;letter-spacing:0.5px;text-transform:uppercase;">
              Campaign Status Update
            </div>
            <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:700;line-height:1.3;">${title}</h2>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              Your campaign <strong style="color:#111827;">"${campaignTitle}"</strong> has ended.
            </p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6;">${message}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:12px;background:${buttonBg};">
                  <a href="${campaignUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;">
                    ${buttonText}
                  </a>
                 </td>
               </tr>
             </table>
           </td>
         </tr>
         <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              You received this because you are the organizer of this Fundy campaign.
            </p>
           </td>
         </tr>
       </table>
     </td>
   </tr>
</table>
</body>
</html>`.trim();
}

// Email builder for donor refund notification (keeping your existing one)
// Email builder for donor refund notification
function buildRefundEmail(campaignTitle: string, message: string, campaignUrl: string, imageUrl?: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">💰 Refund Available</h1>
           </table>
          </tr>
        ${imageUrl ? `<tr><td><img src="${imageUrl}" alt="${campaignTitle}" style="width:100%;height:200px;object-fit:cover;display:block;" /></tr>` : ''}
        <tr>
          <td style="padding:36px 40px;">
            <div style="display:inline-block;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;margin-bottom:20px;letter-spacing:0.5px;text-transform:uppercase;">
              Campaign Ended Without Goal
            </div>
            <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:700;line-height:1.3;">Your donation is ready for refund</h2>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              The campaign <strong style="color:#111827;">"${campaignTitle}"</strong> has ended without reaching its funding goal.
            </p>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              ${message}
            </p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6;">
              You can claim your refund directly from the campaign page. The refund will be sent back to your connected wallet.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:12px;background:#dc2626;">
                  <a href="${campaignUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;">
                    Claim Your Refund →
                  </a>
                 </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                You received this because you donated to this Fundy campaign.<br>
                <a href="${campaignUrl}" style="color:#6b7280;">View Campaign Details</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function useRefundNotifications({ userId, address, provider }: UseRefundNotificationsOptions) {
    const providerRef = useRef(provider);
    useEffect(() => { providerRef.current = provider; }, [provider]);

    useEffect(() => {
        if (!userId || !address || !provider) return;

        let cancelled = false;

        async function checkRefunds() {
            const contract = new ethers.Contract(
                CONTRACT_ADDRESSES.crowdfunding,
                CROWDFUNDING_ABI,
                providerRef.current,
            );

            // Get current user's profile for email
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('id', userId)
                .single();

            const userEmail = userProfile?.email ?? null;

            // ========== CHECK FOR GOAL REACHED (Active Campaigns) ==========
            const { data: activeCampaigns } = await supabase
                .from('campaigns')
                .select('id, title, slug, on_chain_id, image_url, organizer_id')
                .eq('status', 'active');

            if (activeCampaigns?.length) {
                for (const campaign of activeCampaigns) {
                    if (cancelled) return;
                    if (campaign.on_chain_id === null) continue;
                    if (campaign.organizer_id !== userId) continue; // only for organizer's campaigns

                    try {
                        const goalReached = await contract.isGoalReached(campaign.on_chain_id);
                        if (!goalReached) continue;

                        // Check not already notified
                        const { data: existing } = await supabase
                            .from('notifications')
                            .select('id')
                            .eq('user_id', userId)
                            .eq('type', 'campaign_goal_reached')
                            .eq('campaign_id', campaign.id)
                            .maybeSingle();

                        if (existing) continue;

                        // Insert notification
                        const { data: newNotif, error: insertErr } = await supabase
                            .from('notifications')
                            .insert({
                                user_id: userId,
                                type: 'campaign_goal_reached',
                                title: '🎉 Goal Reached!',
                                message: `Your campaign "${campaign.title}" has reached its funding goal! Funds will be available to withdraw.`,
                                campaign_id: campaign.id,
                                is_read: false,
                                email_sent: false,
                            })
                            .select()
                            .single();

                        if (!insertErr && userEmail && newNotif) {
                            // Send email to organizer
                            const campaignUrl = `${window.location.origin}/campaigns/${campaign.slug}`;
                            await sendEmail(
                                userEmail,
                                `🎉 Goal Reached! - ${campaign.title}`,
                                buildGoalReachedEmail(campaign.title, campaignUrl, campaign.image_url ?? undefined)
                            );

                            // Mark email as sent
                            await supabase
                                .from('notifications')
                                .update({ email_sent: true })
                                .eq('id', newNotif.id);
                        }

                    } catch (chainErr: any) {
                        console.warn(`[RefundNotif] Goal check failed for #${campaign.on_chain_id}:`, chainErr.message);
                    }
                }
            }

            // ========== CHECK FOR EXPIRED CAMPAIGNS ==========
            try {
                const { data: expiredCampaigns, error } = await supabase
                    .from('campaigns')
                    .select('id, title, slug, on_chain_id, image_url, organizer_id')
                    .eq('status', 'expired');

                if (error || !expiredCampaigns?.length) return;

                // Check for existing notifications to avoid duplicates
                const { data: existingNotifs } = await supabase
                    .from('notifications')
                    .select('campaign_id, type')
                    .eq('user_id', userId);

                const alreadyNotified = new Map();
                (existingNotifs ?? []).forEach((n: any) => {
                    if (!alreadyNotified.has(n.campaign_id)) {
                        alreadyNotified.set(n.campaign_id, new Set());
                    }
                    alreadyNotified.get(n.campaign_id).add(n.type);
                });

                for (const campaign of expiredCampaigns) {
                    if (cancelled) return;
                    if (campaign.on_chain_id === null) continue;

                    try {
                        // Check if user donated to this campaign
                        const [ethDonated, refundable] = await Promise.all([
                            contract.getEthDonation(campaign.on_chain_id, address),
                            contract.isRefundable(campaign.on_chain_id),
                        ]);

                        const hasDonated = BigInt(ethDonated) > 0n;

                        // ===== DONOR REFUND NOTIFICATION =====
                        if (hasDonated && refundable) {
                            const donorNotified = alreadyNotified.get(campaign.id)?.has('refund_available');
                            if (!donorNotified) {
                                const ethAmt = Number(ethers.formatEther(ethDonated)).toFixed(4);
                                const amountStr = `${ethAmt} ETH`;
                                const message = `Your donation of ${amountStr} is ready to be refunded.`;
                                const campaignUrl = `${window.location.origin}/campaigns/${campaign.slug}`;

                                const { data: newNotif, error: insertErr } = await supabase
                                    .from('notifications')
                                    .insert({
                                        user_id: userId,
                                        type: 'refund_available',
                                        title: 'Refund Available',
                                        message,
                                        campaign_id: campaign.id,
                                        is_read: false,
                                        email_sent: false,
                                    })
                                    .select()
                                    .single();

                                if (!insertErr && userEmail && newNotif) {
                                    await sendEmail(
                                        userEmail,
                                        `💰 Refund available — ${campaign.title}`,
                                        buildRefundEmail(campaign.title, message, campaignUrl, campaign.image_url ?? undefined)
                                    );

                                    await supabase
                                        .from('notifications')
                                        .update({ email_sent: true })
                                        .eq('id', newNotif.id);
                                }
                            }
                        }

                        // ===== ORGANIZER EXPIRY NOTIFICATION =====
                        if (campaign.organizer_id === userId) {
                            const campaignUrl = `${window.location.origin}/campaigns/${campaign.slug}`;
                            const goalReached = await contract.isGoalReached(campaign.on_chain_id);

                            if (refundable) {
                                // Goal not met — expired with refunds
                                const orgNotifiedExpired = alreadyNotified.get(campaign.id)?.has('campaign_expired');

                                if (!orgNotifiedExpired) {
                                    const { data: newNotif, error: insertErr } = await supabase
                                        .from('notifications')
                                        .insert({
                                            user_id: userId,
                                            type: 'campaign_expired',
                                            title: 'Campaign Expired',
                                            message: `Your campaign "${campaign.title}" has expired without reaching its goal. Donors can now claim refunds.`,
                                            campaign_id: campaign.id,
                                            is_read: false,
                                            email_sent: false,
                                        })
                                        .select()
                                        .single();

                                    if (!insertErr && userEmail && newNotif) {
                                        await sendEmail(
                                            userEmail,
                                            `📢 Campaign Ended - ${campaign.title}`,
                                            buildCampaignExpiredEmail(campaign.title, false, campaignUrl, campaign.image_url ?? undefined)
                                        );

                                        await supabase
                                            .from('notifications')
                                            .update({ email_sent: true })
                                            .eq('id', newNotif.id);
                                    }
                                }
                            } else if (goalReached) {
                                // Goal met — organizer can withdraw
                                const orgNotifiedGoal = alreadyNotified.get(campaign.id)?.has('campaign_goal_reached');

                                if (!orgNotifiedGoal) {
                                    const { data: newNotif, error: insertErr } = await supabase
                                        .from('notifications')
                                        .insert({
                                            user_id: userId,
                                            type: 'campaign_goal_reached',
                                            title: '🎉 Goal Reached!',
                                            message: `Your campaign "${campaign.title}" has ended and reached its goal! You can now withdraw the funds.`,
                                            campaign_id: campaign.id,
                                            is_read: false,
                                            email_sent: false,
                                        })
                                        .select()
                                        .single();

                                    if (!insertErr && userEmail && newNotif) {
                                        await sendEmail(
                                            userEmail,
                                            `🎉 Campaign Successful - ${campaign.title}`,
                                            buildCampaignExpiredEmail(campaign.title, true, campaignUrl, campaign.image_url ?? undefined)
                                        );

                                        await supabase
                                            .from('notifications')
                                            .update({ email_sent: true })
                                            .eq('id', newNotif.id);
                                    }
                                }
                            }
                        }

                    } catch (chainErr: any) {
                        console.warn(`[RefundNotif] Chain check failed for #${campaign.on_chain_id}:`, chainErr.message);
                    }
                }
            } catch (err: any) {
                console.warn('[RefundNotif] Error:', err.message);
            }
        }

        // Run on mount
        checkRefunds();

        // Re-run when user comes back to the tab
        function onVisibilityChange() {
            if (document.visibilityState === 'visible') {
                checkRefunds();
            }
        }

        // Optional: Check every 5 minutes when the tab is visible
        let interval: NodeJS.Timeout;
        function startInterval() {
            if (interval) clearInterval(interval);
            interval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    checkRefunds();
                }
            }, 5 * 60 * 1000); // Check every 5 minutes
        }

        startInterval();
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (interval) clearInterval(interval);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, address, provider]);
}