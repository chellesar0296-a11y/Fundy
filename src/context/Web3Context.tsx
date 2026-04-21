import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';

export const CONTRACT_ADDRESSES = {
  crowdfunding: '0x0000000000000000000000000000000000000000', // UPDATE after redeploy
  token:        '0x0000000000000000000000000000000000000000', // UPDATE after redeploy
  nft:          '0x0000000000000000000000000000000000000000', // UPDATE after redeploy
};

export const CROWDFUNDING_ABI = [
  // Views
  'function campaignCount() view returns (uint256)',
  'function getCampaign(uint256) view returns (tuple(string supabaseId, address organizer, uint256 goalAmount, uint256 deadline, uint256 totalRaised, bool withdrawn, bool cancelled, bool hasExtraToken, uint256 extraTokenAmount, uint256 extraTokenMinDonate, bool hasNft))',
  'function getDonation(uint256, address) view returns (uint256)',
  'function getDonors(uint256) view returns (address[])',
  'function isGoalReached(uint256) view returns (bool)',
  'function isRefundable(uint256) view returns (bool)',
  // Write
  'function createCampaign(string, uint256, uint256, string, uint256, uint256) returns (uint256)',
  'function donate(uint256) payable',
  'function donateWithFdy(uint256, uint256)',
  'function withdraw(uint256)',
  'function claimRefund(uint256)',
  'function cancelCampaign(uint256)',
  // Events
  'event CampaignCreated(uint256 indexed campaignId, string supabaseId, address organizer, uint256 goal, uint256 deadline)',
  'event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 ethAmount, uint256 fdyMinted)',
  'event ExtraFdyAwarded(uint256 indexed campaignId, address indexed donor, uint256 fdyAmount)',
  'event NftAwarded(uint256 indexed campaignId, address indexed donor, uint256 tokenId)',
  'event FdyDonation(uint256 indexed campaignId, address indexed donor, uint256 fdyBurned, uint256 ethEquivalent)',
  'event FundsWithdrawn(uint256 indexed campaignId, address organizer, uint256 amount)',
  'event RefundIssued(uint256 indexed campaignId, address indexed donor, uint256 amount)',
  'event CampaignCancelled(uint256 indexed campaignId)',
];

export const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function TOKENS_PER_ETH() view returns (uint256)',
  'function fdyToEth(uint256) view returns (uint256)',
];

export const NFT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
  'function campaignNftUri(uint256) view returns (string)',
  'function totalMinted() view returns (uint256)',
];

interface Web3ContextType {
  provider:      ethers.BrowserProvider | null;
  signer:        ethers.JsonRpcSigner | null;
  address:       string | null;
  chainId:       number | null;
  fdyBalance:    string;
  ethBalance:    string;
  isConnected:   boolean;
  isConnecting:  boolean;
  error:         string | null;
  connect:       () => Promise<void>;
  disconnect:    () => void;
  refreshBalance: () => Promise<void>;
  createCampaignOnChain: (
    supabaseId: string, goalEth: string, deadlineTs: number,
    nftUri: string, extraFdyAmount: string, extraFdyMinDonate: string
  ) => Promise<number>;
  donateEth:          (onChainId: number, amountEth: string) => Promise<any>;
  donateWithFdy:      (onChainId: number, fdyAmount: string) => Promise<any>;
  withdrawFunds:      (onChainId: number) => Promise<any>;
  claimRefund:        (onChainId: number) => Promise<any>;
  cancelCampaignOnChain: (onChainId: number) => Promise<any>;
  getCampaignOnChain: (onChainId: number) => Promise<any>;
  getDonationAmount:  (onChainId: number, donor: string) => Promise<string>;
  approveExtraFdy:    (amount: string) => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

async function getBalances(prov: ethers.BrowserProvider, addr: string) {
  const ethBal = await prov.getBalance(addr);
  let fdy = '0';
  try {
    if (CONTRACT_ADDRESSES.token !== '0x0000000000000000000000000000000000000000') {
      const tk = new ethers.Contract(CONTRACT_ADDRESSES.token, TOKEN_ABI, prov);
      fdy = Number(ethers.formatEther(await tk.balanceOf(addr))).toFixed(2);
    }
  } catch {}
  return { eth: Number(ethers.formatEther(ethBal)).toFixed(4), fdy };
}

export function Web3Provider({
  children, userId, boundWalletAddress,
}: {
  children: React.ReactNode;
  userId?: string;
  boundWalletAddress?: string | null;
}) {
  const [provider,     setProvider]     = useState<ethers.BrowserProvider | null>(null);
  const [signer,       setSigner]       = useState<ethers.JsonRpcSigner | null>(null);
  const [address,      setAddress]      = useState<string | null>(null);
  const [chainId,      setChainId]      = useState<number | null>(null);
  const [fdyBalance,   setFdyBalance]   = useState('0');
  const [ethBalance,   setEthBalance]   = useState('0');
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const applyBalances = (bal: { eth: string; fdy: string }) => {
    setEthBalance(bal.eth); setFdyBalance(bal.fdy);
  };

  const setConnected = (prov: ethers.BrowserProvider, sgn: ethers.JsonRpcSigner, addr: string, chain: number, bal: { eth: string; fdy: string }) => {
    setProvider(prov); setSigner(sgn); setAddress(addr);
    setChainId(chain); setIsConnected(true); applyBalances(bal);
  };

  // ── Auto-reconnect to bound wallet (no popup) ───────────────
  useEffect(() => {
    if (!boundWalletAddress || !window.ethereum || isConnected) return;
    (async () => {
      try {
        const prov     = new ethers.BrowserProvider(window.ethereum);
        const accounts: string[] = await prov.send('eth_accounts', []);
        const match    = accounts.find(a => a.toLowerCase() === boundWalletAddress.toLowerCase());
        if (!match) return;
        const sgn     = await prov.getSigner(match);
        const network = await prov.getNetwork();
        const bal     = await getBalances(prov, match);
        setConnected(prov, sgn, match, Number(network.chainId), bal);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundWalletAddress]);

  // ── Connect ────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) { setError('MetaMask not detected. Please install MetaMask.'); return; }
    setIsConnecting(true); setError(null);

    try {
      const prov = new ethers.BrowserProvider(window.ethereum);

      if (boundWalletAddress) {
        // Account already bound — just connect to it
        await prov.send('eth_requestAccounts', []);
        const sgn  = await prov.getSigner();
        const addr = await sgn.getAddress();

        if (addr.toLowerCase() !== boundWalletAddress.toLowerCase()) {
          setError(`Wrong wallet. Please switch MetaMask to: ${boundWalletAddress.slice(0,10)}...${boundWalletAddress.slice(-6)}`);
          return;
        }
        const network = await prov.getNetwork();
        const bal     = await getBalances(prov, addr);
        setConnected(prov, sgn, addr, Number(network.chainId), bal);
        return;
      }

      // No bound wallet — force account picker + signature
      try {
        await prov.send('wallet_requestPermissions', [{ eth_accounts: {} }]);
      } catch (e: any) {
        if (e?.code === 4001) { setError('Connection cancelled.'); return; }
        await prov.send('eth_requestAccounts', []);
      }

      const sgn  = await prov.getSigner();
      const addr = await sgn.getAddress();

      // Sign to verify ownership
      try {
        const msg = `Welcome to Fundy!\n\nSigning this message verifies you own this wallet.\n\nWallet: ${addr}\nTimestamp: ${Date.now()}`;
        await sgn.signMessage(msg);
      } catch (e: any) {
        if (e?.code === 4001) { setError('Please sign the message to verify wallet ownership.'); return; }
      }

      const network = await prov.getNetwork();
      const bal     = await getBalances(prov, addr);
      setConnected(prov, sgn, addr, Number(network.chainId), bal);

      // Bind wallet to profile
      if (userId) {
        await supabase.from('profiles').update({ wallet_address: addr }).eq('id', userId);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [userId, boundWalletAddress]);

  const disconnect = useCallback(() => {
    setProvider(null); setSigner(null); setAddress(null); setChainId(null);
    setFdyBalance('0'); setEthBalance('0'); setIsConnected(false); setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!provider || !address) return;
    const bal = await getBalances(provider, address);
    applyBalances(bal);
  }, [provider, address]);

  // MetaMask events
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts: string[]) => {
      if (accounts.length === 0) { disconnect(); return; }
      if (boundWalletAddress && accounts[0].toLowerCase() !== boundWalletAddress.toLowerCase()) {
        disconnect();
        setError('Please switch back to your linked wallet.');
        return;
      }
      setAddress(accounts[0]);
      if (provider) getBalances(provider, accounts[0]).then(applyBalances).catch(() => {});
    };
    const onChain = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccounts);
    window.ethereum.on('chainChanged', onChain);
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccounts);
      window.ethereum?.removeListener('chainChanged', onChain);
    };
  }, [disconnect, provider, boundWalletAddress]);

  // ── Contract getters ────────────────────────────────────────
  const cf  = useCallback((w = false) => {
    if (!provider) throw new Error('Wallet not connected');
    return new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, w ? signer! : provider);
  }, [provider, signer]);

  const tk = useCallback((w = false) => {
    if (!provider) throw new Error('Wallet not connected');
    return new ethers.Contract(CONTRACT_ADDRESSES.token, TOKEN_ABI, w ? signer! : provider);
  }, [provider, signer]);

  // ── Contract actions ────────────────────────────────────────
  const createCampaignOnChain = useCallback(async (
    supabaseId: string, goalEth: string, deadlineTs: number,
    nftUri: string, extraFdyAmount: string, extraFdyMinDonate: string,
  ): Promise<number> => {
    const extraFdyWei  = extraFdyAmount ? ethers.parseEther(extraFdyAmount) : 0n;
    const extraMinWei  = extraFdyMinDonate ? ethers.parseEther(extraFdyMinDonate) : 0n;
    const tx      = await cf(true).createCampaign(supabaseId, ethers.parseEther(goalEth), deadlineTs, nftUri, extraFdyWei, extraMinWei);
    const receipt = await tx.wait();
    const iface   = new ethers.Interface(CROWDFUNDING_ABI);
    for (const log of receipt.logs) {
      try { const p = iface.parseLog(log); if (p?.name === 'CampaignCreated') return Number(p.args.campaignId); } catch {}
    }
    throw new Error('CampaignCreated event not found');
  }, [cf]);

  const donateEth = useCallback(async (id: number, amtEth: string) => {
    const tx = await cf(true).donate(id, { value: ethers.parseEther(amtEth) });
    const r  = await tx.wait(); await refreshBalance(); return r;
  }, [cf, refreshBalance]);

  const donateWithFdy = useCallback(async (id: number, fdyAmt: string) => {
    const wei = ethers.parseEther(fdyAmt);
    // Must approve first
    const approveTx = await tk(true).approve(CONTRACT_ADDRESSES.crowdfunding, wei);
    await approveTx.wait();
    const tx = await cf(true).donateWithFdy(id, wei);
    const r  = await tx.wait(); await refreshBalance(); return r;
  }, [cf, tk, refreshBalance]);

  const approveExtraFdy = useCallback(async (amount: string) => {
    const wei = ethers.parseEther(amount);
    const tx  = await tk(true).approve(CONTRACT_ADDRESSES.crowdfunding, wei);
    await tx.wait();
  }, [tk]);

  const withdrawFunds         = useCallback(async (id: number) => (await (await cf(true).withdraw(id)).wait()), [cf]);
  const claimRefund           = useCallback(async (id: number) => (await (await cf(true).claimRefund(id)).wait()), [cf]);
  const cancelCampaignOnChain = useCallback(async (id: number) => (await (await cf(true).cancelCampaign(id)).wait()), [cf]);
  const getCampaignOnChain    = useCallback(async (id: number) => await cf().getCampaign(id), [cf]);
  const getDonationAmount     = useCallback(async (id: number, donor: string) => ethers.formatEther(await cf().getDonation(id, donor)), [cf]);

  return (
    <Web3Context.Provider value={{
      provider, signer, address, chainId, fdyBalance, ethBalance,
      isConnected, isConnecting, error,
      connect, disconnect, refreshBalance,
      createCampaignOnChain, donateEth, donateWithFdy,
      withdrawFunds, claimRefund, cancelCampaignOnChain,
      getCampaignOnChain, getDonationAmount, approveExtraFdy,
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside <Web3Provider>');
  return ctx;
}

declare global { interface Window { ethereum?: any; } }
