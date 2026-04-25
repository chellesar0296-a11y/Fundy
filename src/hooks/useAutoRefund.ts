import { useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { useWeb3, CONTRACT_ADDRESSES, CROWDFUNDING_ABI } from '@/context/Web3Context';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

export function useAutoRefund() {
    const { provider, signer, address } = useWeb3();

    useEffect(() => {
        if (!provider) return;

        const contract = new ethers.Contract(
            CONTRACT_ADDRESSES.crowdfunding,
            CROWDFUNDING_ABI,
            provider
        );

        const checkAndRefund = async () => {
            try {
                const count = await contract.campaignCount();
                const latestBlock = await provider.getBlock('latest');
                const now = BigInt(latestBlock!.timestamp);

                for (let i = 1; i <= Number(count); i++) {
                    const c = await contract.getCampaign(i);

                    const expired = now >= c.deadline;
                    const goalNotMet = (c.totalRaisedEth + c.totalRaisedFdy) < c.goalAmount;
                    const notProcessed = !c.cancelled && !c.withdrawn;

                    if (expired && goalNotMet && notProcessed) {
                        await fetch(`${SUPABASE_URL}/rest/v1/campaigns?on_chain_id=eq.${i}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            },
                            body: JSON.stringify({ status: 'expired', on_chain_id: Number(i) }),
                        });
                    }

                    if (expired && goalNotMet && notProcessed && signer && address) {
                        const isMyCampaign = c.organizer.toLowerCase() === address.toLowerCase();
                        if (isMyCampaign) {
                            try {
                                const fresh = await contract.getCampaign(i);
                                if (fresh.cancelled || fresh.withdrawn) {
                                    console.log(`Campaign ${i} already processed, skipping`);
                                    continue;
                                }

                                // ✅ Notify organizer before triggering
                                toast.info(`Campaign #${i} has expired and did not reach its goal. Processing donor refunds...`, {
                                    duration: 8000,
                                });

                                console.log(`Campaign ${i} expired → triggering refund...`);
                                const signerContract = new ethers.Contract(
                                    CONTRACT_ADDRESSES.crowdfunding,
                                    CROWDFUNDING_ABI,
                                    signer
                                );
                                const tx = await signerContract.triggerExpiredRefunds(i);
                                await tx.wait();

                                // ✅ Success notification
                                toast.success(`Campaign #${i} refunds processed! All donors have been refunded automatically.`, {
                                    duration: 10000,
                                });
                                console.log(`Campaign ${i} refunded ✅`);
                            } catch (refundErr: any) {
                                toast.error(`Campaign #${i} refund failed. Please try again.`);
                                console.warn(`Campaign ${i} refund skipped:`, refundErr?.reason ?? refundErr?.message);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Auto refund check failed:', err);
            }
        };

        checkAndRefund();
        const interval = setInterval(checkAndRefund, 60000);
        return () => clearInterval(interval);

    }, [provider, signer, address]);
}