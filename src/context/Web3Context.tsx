import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { bindWalletAddress } from '@/lib/supabase';

// ── Contract addresses ────────────────────────────────────────
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
  'function tokensToEth(uint256) view returns (uint256)',
];

// ── Types ─────────────────────────────────────────────────────
interface Web3ContextType {
  provider:     ethers.BrowserProvider | null;
  signer:       ethers.JsonRpcSigner   | null;
  address:      string | null;
  chainId:      number | null;
  fdyBalance:   string;
  ethBalance:   string;
  isConnected:  boolean;
  isConnecting: boolean;
  error:        string | null;
  connect:      () => Promise<void>;
  disconnect:   () => void;
  refreshBalance: () => Promise<void>;
  // Contract actions
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

// ── Provider ──────────────────────────────────────────────────
export function Web3Provider({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const [provider,     setProvider]     = useState<ethers.BrowserProvider | null>(null);
  const [signer,       setSigner]       = useState<ethers.JsonRpcSigner   | null>(null);
  const [address,      setAddress]      = useState<string | null>(null);
  const [chainId,      setChainId]      = useState<number | null>(null);
  const [fdyBalance,   setFdyBalance]   = useState('0');
  const [ethBalance,   setEthBalance]   = useState('0');
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchBalances = useCallback(async (
    prov: ethers.BrowserProvider,
    addr: string,
  ) => {
    try {
      // ETH balance
      const ethBal = await prov.getBalance(addr);
      setEthBalance(Number(ethers.formatEther(ethBal)).toFixed(4));

      // FDY balance
      if (CONTRACT_ADDRESSES.token !== '0x0000000000000000000000000000000000000000') {
        const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.token, TOKEN_ABI, prov);
        const fdyBal = await tokenContract.balanceOf(addr);
        setFdyBalance(Number(ethers.formatEther(fdyBal)).toFixed(2));
      }
    } catch (e) {
      console.error('[Web3] fetchBalances error:', e);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const prov    = new ethers.BrowserProvider(window.ethereum);
      await prov.send('eth_requestAccounts', []);
      const sgn     = await prov.getSigner();
      const addr    = await sgn.getAddress();
      const network = await prov.getNetwork();

      setProvider(prov);
      setSigner(sgn);
      setAddress(addr);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      await fetchBalances(prov, addr);

      // Auto-bind wallet to Supabase profile
      if (userId) {
        bindWalletAddress(userId, addr).catch(console.error);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [userId, fetchBalances]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setFdyBalance('0');
    setEthBalance('0');
    setIsConnected(false);
    setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (provider && address) await fetchBalances(provider, address);
  }, [provider, address, fetchBalances]);

  // Listen for MetaMask account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else {
        setAddress(accounts[0]);
        if (provider) fetchBalances(provider, accounts[0]);
      }
    };
    const onChainChanged = () => window.location.reload();

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener('chainChanged', onChainChanged);
    };
  }, [disconnect, provider, fetchBalances]);

  // ── Contract helpers ────────────────────────────────────────
  const getCrowdfunding = useCallback((write = false) => {
    if (!provider) throw new Error('Wallet not connected');
    return new ethers.Contract(
      CONTRACT_ADDRESSES.crowdfunding,
      CROWDFUNDING_ABI,
      write ? signer! : provider,
    );
  }, [provider, signer]);

  const getToken = useCallback((write = false) => {
    if (!provider) throw new Error('Wallet not connected');
    return new ethers.Contract(
      CONTRACT_ADDRESSES.token,
      TOKEN_ABI,
      write ? signer! : provider,
    );
  }, [provider, signer]);

  const createCampaignOnChain = useCallback(async (
    supabaseId: string,
    goalEth: string,
    deadlineTs: number,
  ): Promise<number> => {
    const contract = getCrowdfunding(true);
    const tx       = await contract.createCampaign(
      supabaseId,
      ethers.parseEther(goalEth),
      deadlineTs,
    );
    const receipt = await tx.wait();
    const iface   = new ethers.Interface(CROWDFUNDING_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'CampaignCreated') return Number(parsed.args.campaignId);
      } catch {}
    }
    throw new Error('CampaignCreated event not found');
  }, [getCrowdfunding]);

  const donateEth = useCallback(async (onChainId: number, amountEth: string) => {
    const contract = getCrowdfunding(true);
    const tx       = await contract.donate(onChainId, { value: ethers.parseEther(amountEth) });
    const receipt  = await tx.wait();
    await refreshBalance();
    return receipt;
  }, [getCrowdfunding, refreshBalance]);

  const donateWithTokens = useCallback(async (onChainId: number, tokenAmount: string) => {
    const token        = getToken(true);
    const crowdfunding = getCrowdfunding(true);
    const amountWei    = ethers.parseEther(tokenAmount);

    const approveTx = await token.approve(CONTRACT_ADDRESSES.crowdfunding, amountWei);
    await approveTx.wait();

    const tx      = await crowdfunding.donateWithTokens(onChainId, amountWei);
    const receipt = await tx.wait();
    await refreshBalance();
    return receipt;
  }, [getCrowdfunding, getToken, refreshBalance]);

  const withdrawFunds = useCallback(async (onChainId: number) => {
    const tx = await getCrowdfunding(true).withdraw(onChainId);
    return await tx.wait();
  }, [getCrowdfunding]);

  const claimRefund = useCallback(async (onChainId: number) => {
    const tx = await getCrowdfunding(true).claimRefund(onChainId);
    return await tx.wait();
  }, [getCrowdfunding]);

  const cancelCampaignOnChain = useCallback(async (onChainId: number) => {
    const tx = await getCrowdfunding(true).cancelCampaign(onChainId);
    return await tx.wait();
  }, [getCrowdfunding]);

  const getCampaignOnChain = useCallback(async (onChainId: number) => {
    return await getCrowdfunding().getCampaign(onChainId);
  }, [getCrowdfunding]);

  const getDonationAmount = useCallback(async (onChainId: number, donor: string) => {
    const wei = await getCrowdfunding().getDonation(onChainId, donor);
    return ethers.formatEther(wei);
  }, [getCrowdfunding]);

  const value: Web3ContextType = {
    provider, signer, address, chainId,
    fdyBalance, ethBalance,
    isConnected, isConnecting, error,
    connect, disconnect, refreshBalance,
    createCampaignOnChain, donateEth, donateWithTokens,
    withdrawFunds, claimRefund, cancelCampaignOnChain,
    getCampaignOnChain, getDonationAmount,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────
export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside <Web3Provider>');
  return ctx;
}

declare global {
  interface Window { ethereum?: any; }
}
