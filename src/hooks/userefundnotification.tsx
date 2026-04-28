import { useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';
import { CONTRACT_ADDRESSES, CROWDFUNDING_ABI } from '@/context/Web3Context';

interface UseRefundNotificationsOptions {
    userId: string | null;
    address: string | null;
    provider: ethers.BrowserProvider | null;
}

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
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">💰 Fundy</h1>
          </td>
        </tr>
        ${imageUrl ? `<tr><td><img src="${imageUrl}" alt="${campaignTitle}" style="width:100%;height:200px;object-fit:cover;display:block;" /></td></tr>` : ''}
        <tr>
          <td style="padding:36px 40px;">
            <div style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;margin-bottom:20px;letter-spacing:0.5px;text-transform:uppercase;">
              Refund Available
            </div>
            <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:700;line-height:1.3;">Your donation can be refunded</h2>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              The campaign <strong style="color:#111827;">"${campaignTitle}"</strong> did not reach its funding goal and has expired.
            </p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6;">${message}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:12px;background:#111827;">
                  <a href="${campaignUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;">
                    Claim My Refund →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
              Your refund will be sent directly to your connected wallet. Make sure MetaMask is connected when you visit the campaign page.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              You received this because you donated to a Fundy campaign.<br>
              <a href="${campaignUrl}" style="color:#6b7280;">View Campaign</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
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
            const { data: activeCampaigns } = await supabase
                .from('campaigns')
                .select('id, title, slug, on_chain_id, image_url, organizer_id')
                .eq('status', 'active');

            if (activeCampaigns?.length) {
                for (const campaign of activeCampaigns) {
                    if (cancelled) return;
                    if (campaign.on_chain_id === null) continue;
                    if (campaign.organizer_id !== userId) continue; // only notify the organizer

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

                        await supabase.from('notifications').insert({
                            user_id: userId,
                            type: 'campaign_goal_reached',
                            title: '🎉 Goal Reached!',
                            message: `Your campaign "${campaign.title}" has reached its funding goal! Funds will be available to withdraw once the campaign ends.`,
                            campaign_id: campaign.id,
                            is_read: false,
                            email_sent: false,
                        });

                    } catch (chainErr: any) {
                        console.warn(`[RefundNotif] Goal check failed for #${campaign.on_chain_id}:`, chainErr.message);
                    }
                }
            }
            try {
                const { data: expiredCampaigns, error } = await supabase
                    .from('campaigns')
                    .select('id, title, slug, on_chain_id, image_url')
                    .eq('status', 'expired');

                if (error || !expiredCampaigns?.length) return;

                const { data: existingNotifs } = await supabase
                    .from('notifications')
                    .select('campaign_id')
                    .eq('user_id', userId)
                    .eq('type', 'refund_available');

                const alreadyNotified = new Set((existingNotifs ?? []).map((n: any) => n.campaign_id));

                const { data: { user } } = await supabase.auth.getUser();
                const userEmail = user?.email ?? null;

                const contract = new ethers.Contract(
                    CONTRACT_ADDRESSES.crowdfunding,
                    CROWDFUNDING_ABI,
                    providerRef.current,
                );

                for (const campaign of expiredCampaigns) {
                    if (cancelled) return;
                    if (campaign.on_chain_id === null) continue;
                    if (alreadyNotified.has(campaign.id)) continue;

                    try {
                        const [ethDonated, refundable] = await Promise.all([
                            contract.getEthDonation(campaign.on_chain_id, address),
                            contract.isRefundable(campaign.on_chain_id),
                        ]);

                        const hasDonated = BigInt(ethDonated) > 0n;
                        if (!hasDonated || !refundable) continue;

                        const ethAmt = Number(ethers.formatEther(ethDonated)).toFixed(4);
                        const amountStr = `${ethAmt} ETH`;
                        const message = `Your donation of ${amountStr} is ready to be refunded.`;
                        const campaignUrl = `${window.location.origin}/campaigns/${campaign.slug}`;

                        if (cancelled) return;

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

                        if (insertErr) {
                            console.warn('[RefundNotif] Skipped duplicate:', campaign.title);
                            continue;
                        }

                        if (userEmail && newNotif) {
                            const { error: emailErr } = await supabase.functions.invoke('send-email', {
                                body: {
                                    to: userEmail,
                                    subject: `💰 Refund available — ${campaign.title}`,
                                    html: buildRefundEmail(
                                        campaign.title,
                                        message,
                                        campaignUrl,
                                        campaign.image_url ?? undefined,
                                    ),
                                },
                            });

                            if (emailErr) {
                                console.warn('[RefundNotif] Email failed:', emailErr.message);
                            } else {
                                await supabase
                                    .from('notifications')
                                    .update({ email_sent: true })
                                    .eq('id', newNotif.id);
                            }
                        }

                        const { data: campaignFull } = await supabase
                            .from('campaigns')
                            .select('organizer_id')
                            .eq('id', campaign.id)
                            .single();

                        if (campaignFull?.organizer_id === userId) {
                            const orgExpiredKey = `org_expired_${campaign.id}`;
                            const { data: existingOrgNotif } = await supabase
                                .from('notifications')
                                .select('id')
                                .eq('user_id', userId)
                                .eq('type', 'campaign_expired')
                                .eq('campaign_id', campaign.id)
                                .maybeSingle();

                            if (!existingOrgNotif) {
                                if (refundable) {
                                    // Goal not met — expired with refunds
                                    await supabase.from('notifications').insert({
                                        user_id: userId,
                                        type: 'campaign_expired',
                                        title: 'Campaign Expired',
                                        message: `Your campaign "${campaign.title}" has expired without reaching its goal. Donors can now claim refunds.`,
                                        campaign_id: campaign.id,
                                        is_read: false,
                                        email_sent: false,
                                    });
                                } else {
                                    // Goal met — organizer can withdraw
                                    await supabase.from('notifications').insert({
                                        user_id: userId,
                                        type: 'campaign_goal_reached',
                                        title: '🎉 Goal Reached!',
                                        message: `Your campaign "${campaign.title}" has ended and reached its goal! You can now withdraw the funds.`,
                                        campaign_id: campaign.id,
                                        is_read: false,
                                        email_sent: false,
                                    });
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

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, address]);
}