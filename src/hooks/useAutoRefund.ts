import { useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3, CONTRACT_ADDRESSES, CROWDFUNDING_ABI } from '@/context/Web3Context';

export function useAutoRefund() {
    const { provider, signer, address } = useWeb3();

    useEffect(() => {
        if (!provider || !signer || !address) return; 

        const contract = new ethers.Contract(
            CONTRACT_ADDRESSES.crowdfunding,
            CROWDFUNDING_ABI,
            signer
        );

        const checkAndRefund = async () => {
            try {
                const count = await contract.campaignCount();
                const now = Math.floor(Date.now() / 1000);

                for (let i = 1; i <= Number(count); i++) {
                    const c = await contract.getCampaign(i);

                    const expired = now >= Number(c.deadline);
                    const goalNotMet = (c.totalRaisedEth + c.totalRaisedFdy) < c.goalAmount;
                    const notProcessed = !c.cancelled && !c.withdrawn;
                    const isMyCampaign = c.organizer.toLowerCase() === address.toLowerCase(); 

                    if (expired && goalNotMet && notProcessed && isMyCampaign) {
                        console.log(`Campaign ${i} expired → triggering refund...`);
                        const tx = await contract.triggerExpiredRefunds(i);
                        await tx.wait();
                        console.log(`Campaign ${i} refunded ✅`);
                    }
                }
            } catch (err) {
                console.error('Auto refund check failed:', err);
            }
        };

        checkAndRefund();
        const interval = setInterval(checkAndRefund, 60000);
        return () => clearInterval(interval);

    }, [provider, signer, address]); // ← 加 address
}