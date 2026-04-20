import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';

export const CONTRACT_ADDRESSES = {
  crowdfunding: '0xfd761737ad21E6993be0EeB6FF27bB15A2A834FC',
  token:        '0x511c8337E4cAC78d2D747F00870db3feA3CaaF76',
};

export const CROWDFUNDING_ABI = [
  'function campaignCount() view returns (uint256)',
  'function getCampaign(uint256) view returns (tuple(string supabaseId, address organizer, uint256 goalAmount, uint256 deadline, uint256 totalRaised, bool withdrawn, bool cancelled))',
  'function getDonation(uint256, address) view returns (uint256)',
  'function isGoalReached(uint256) view returns (bool)',
  'function isRefundable(uint256) view returns (bool)',
  'function createCampaign(string, uint256, uint256) returns (uint256)',
  'function donate(uint256) payable',
  'function donateWithTokens(uint256, uint256)',
  'function withdraw(uint256)',
  'function claimRefund(uint256)',
  'function cancelCampaign(uint256)',
  'event CampaignCreated(uint256 indexed campaignId, string supabaseId, address organizer, uint256 goal, uint256 deadline)',
  'event DonationReceived(uint256 indexed campaignId, address donor, uint256 amount, uint256 tokensAwarded)',
  'event FundsWithdrawn(uint256 indexed campaignId, address organizer, uint256 amount)',
  'event RefundIssued(uint256 indexed campaignId, address donor, uint256 amount)',
  'event CampaignCancelled(uint256 indexed campaignId)',
];

export const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function TOKENS_PER_ETH() view returns (uint256)',
];

interface Web3ContextType {
  provider:      ethers.BrowserProvider | null;
  signer:        ethers.JsonRpcSigner   | null;
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
  createCampaignOnChain: (supabaseId: string, goalEth: string, deadlineTs: number) => Promise<number>;
  donateEth:             (onChainId: number, amountEth: string) => Promise<any>;
  donateWithTokens:      (onChainId: number, tokenAmount: string) => Promise<any>;
  withdrawFunds:         (onChainId: number) => Promise<any>;
  claimRefund:           (onChainId: number) => Promise<any>;
  cancelCampaignOnChain: (onChainId: number) => Promise<any>;
  getCampaignOnChain:    (onChainId: number) => Promise<any>;
  getDonationAmount:     (onChainId: number, donor: string) => Promise<string>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

async function getBalances(prov: ethers.BrowserProvider, addr: string) {
  const ethBal = await prov.getBalance(addr);
  let fdy = '0';
  try {
    const token = new ethers.Contract(CONTRACT_ADDRESSES.token, TOKEN_ABI, prov);
    fdy = Number(ethers.formatEther(await token.balanceOf(addr))).toFixed(2);
  } catch {}
  return { eth: Number(ethers.formatEther(ethBal)).toFixed(4), fdy };
}

export function Web3Provider({
  children,
  userId,
  boundWalletAddress,
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

  const applyState = (prov: ethers.BrowserProvider, sgn: ethers.JsonRpcSigner, addr: string, chainId: number, bal: {eth:string;fdy:string}) => {
    setProvider(prov); setSigner(sgn); setAddress(addr);
    setChainId(chainId); setEthBalance(bal.eth); setFdyBalance(bal.fdy);
    setIsConnected(true);
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
        const sgn      = await prov.getSigner(match);
        const network  = await prov.getNetwork();
        const bal      = await getBalances(prov, match);
        applyState(prov, sgn, match, Number(network.chainId), bal);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundWalletAddress]);

  // ── Connect ────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) { setError('MetaMask not detected.'); return; }
    setIsConnecting(true); setError(null);

    try {
      const prov = new ethers.BrowserProvider(window.ethereum);

      // ─ Already has bound wallet ─
      if (boundWalletAddress) {
        const accounts: string[] = await prov.send('eth_requestAccounts', []);
        const match = accounts.find(a => a.toLowerCase() === boundWalletAddress.toLowerCase());

        if (!match) {
          setError(`Please switch MetaMask to your linked wallet:\n${boundWalletAddress.slice(0,10)}...${boundWalletAddress.slice(-6)}`);
          return;
        }

        const sgn     = await prov.getSigner(match);
        const network = await prov.getNetwork();
        const bal     = await getBalances(prov, match);
        applyState(prov, sgn, match, Number(network.chainId), bal);
        return;
      }

      // ─ No bound wallet — force MetaMask account picker ─
      try {
        await prov.send('wallet_requestPermissions', [{ eth_accounts: {} }]);
      } catch (e: any) {
        if (e?.code === 4001) { setError('Connection cancelled.'); return; }
        await prov.send('eth_requestAccounts', []);
      }

      const sgn  = await prov.getSigner();
      const addr = await sgn.getAddress();

      // Sign message to prove ownership
      let signed = false;
      try {
        const msg = `Welcome to Fundy!\n\nVerify wallet ownership.\nWallet: ${addr}\nTime: ${Date.now()}`;
        await sgn.signMessage(msg);
        signed = true;
      } catch (e: any) {
        if (e?.code === 4001) { setError('Please sign the message to verify wallet ownership.'); return; }
      }

      const network = await prov.getNetwork();
      const bal     = await getBalances(prov, addr);
      applyState(prov, sgn, addr, Number(network.chainId), bal);

      // Save to Supabase — one wallet per account
      if (userId) {
        await supabase.from('profiles').update({ wallet_address: addr }).eq('id', userId);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to connect');
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
    setEthBalance(bal.eth); setFdyBalance(bal.fdy);
  }, [provider, address]);

  // MetaMask event listeners
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts: string[]) => {
      if (accounts.length === 0) { disconnect(); return; }
      if (boundWalletAddress && accounts[0].toLowerCase() !== boundWalletAddress.toLowerCase()) {
        disconnect();
        setError(`Please switch back to your linked wallet.`);
        return;
      }
      setAddress(accounts[0]);
      if (provider) getBalances(provider, accounts[0]).then(b => { setEthBalance(b.eth); setFdyBalance(b.fdy); }).catch(() => {});
    };
    const onChain = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccounts);
    window.ethereum.on('chainChanged', onChain);
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccounts);
      window.ethereum?.removeListener('chainChanged', onChain);
    };
  }, [disconnect, provider, boundWalletAddress]);

  // ── Contract helpers ────────────────────────────────────────
  const cf  = useCallback((w=false) => { if (!provider) throw new Error('Not connected'); return new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, w ? signer! : provider); }, [provider, signer]);
  const tkn = useCallback((w=false) => { if (!provider) throw new Error('Not connected'); return new ethers.Contract(CONTRACT_ADDRESSES.token, TOKEN_ABI, w ? signer! : provider); }, [provider, signer]);

  const createCampaignOnChain = useCallback(async (supabaseId: string, goalEth: string, deadlineTs: number) => {
    const tx = await cf(true).createCampaign(supabaseId, ethers.parseEther(goalEth), deadlineTs);
    const receipt = await tx.wait();
    const iface = new ethers.Interface(CROWDFUNDING_ABI);
    for (const log of receipt.logs) {
      try { const p = iface.parseLog(log); if (p?.name === 'CampaignCreated') return Number(p.args.campaignId); } catch {}
    }
    throw new Error('CampaignCreated event not found');
  }, [cf]);

  const donateEth = useCallback(async (id: number, amt: string) => {
    const tx = await cf(true).donate(id, { value: ethers.parseEther(amt) });
    const r  = await tx.wait(); await refreshBalance(); return r;
  }, [cf, refreshBalance]);

  const donateWithTokens = useCallback(async (id: number, amt: string) => {
    const wei = ethers.parseEther(amt);
    await (await tkn(true).approve(CONTRACT_ADDRESSES.crowdfunding, wei)).wait();
    const r = await (await cf(true).donateWithTokens(id, wei)).wait();
    await refreshBalance(); return r;
  }, [cf, tkn, refreshBalance]);

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
      createCampaignOnChain, donateEth, donateWithTokens,
      withdrawFunds, claimRefund, cancelCampaignOnChain,
      getCampaignOnChain, getDonationAmount,
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
