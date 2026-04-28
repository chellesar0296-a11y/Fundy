import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';

export const CONTRACT_ADDRESSES = {
  crowdfunding: '0x10306e1F06F6eD9272e72A6dBdc1b91783101FDa',
  token:        '0xA3e13959c7f3327F2c06E3155A8343Cfef705147',
  batchTransfer: '0x8BD1aA336BaC450C7b15dfa63D2cfAe65978e22B',
};

export const CROWDFUNDING_ABI = [
  // ── Views ──
  'function campaignCount() view returns (uint256)',
  'function initialized() view returns (bool)',
  'function owner() view returns (address)',
  'function admins(address) view returns (bool)',
  'function TOKENS_PER_ETH() view returns (uint256)',

  `function getCampaign(uint256 id) view returns (
    tuple(
      string  supabaseId,
      address organizer,
      uint256 goalAmount,
      uint256 deadline,
      uint256 totalRaisedEth,
      bool    withdrawn,
      bool    cancelled,
      address stakeToken,
      string  tokenSymbol,
      bool    hasExtraToken,
      uint256 extraQuantity,
      uint256 extraFdyAmount,
      uint256 extraMinDonate,
      uint256 extraAwarded
    )
  )`,

  'function getEthDonation(uint256 id, address donor) view returns (uint256)',
  'function getDonors(uint256 id) view returns (address[])',
  'function totalRaised(uint256 id) view returns (uint256)',
  'function isGoalReached(uint256 id) view returns (bool)',
  'function isRefundable(uint256 id) view returns (bool)',
  'function stakeBalance(uint256 id, address donor) view returns (uint256)',
  'function totalStake(uint256 id) view returns (uint256)',
  'function estimatedExtraCost(uint256 id) view returns (uint256)',
  'function getExtraRewardInfo(uint256 id) view returns (bool hasExtra, uint256 quantity, uint256 fdyAmount, uint256 minDonate, uint256 slotsRemaining)',
  'function isDonor(uint256, address) view returns (bool)',
  'function extraAwarded(uint256, address) view returns (bool)',
  'function donors(uint256, uint256) view returns (address)',

  // ── Write ──
  // 7 params: supabaseId, goalWei, deadline, campaignTitle, extraQuantity, extraFdyAmount, extraMinDonate
  'function createCampaign(string supabaseId, uint256 goalWei, uint256 deadline, string campaignTitle, uint256 extraQuantity, uint256 extraFdyAmount, uint256 extraMinDonate) returns (uint256)',
  'function init()',
  'function donate(uint256 campaignId) payable',
  'function withdraw(uint256 campaignId)',
  'function claimRefund(uint256 campaignId)',
  'function cancelCampaign(uint256 campaignId)',
  'function triggerExpiredRefunds(uint256 campaignId)',
  'function addAdmin(address admin)',
  'function removeAdmin(address admin)',
  'function transferOwnership(address newOwner)',

  // ── Events ──
  'event CampaignCreated(uint256 indexed campaignId, string supabaseId, address organizer, uint256 goal, uint256 deadline, address stakeToken, string tokenSymbol)',
  'event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 ethAmount)',
  'event FundsWithdrawn(uint256 indexed campaignId, address organizer, uint256 ethPaid, uint256 autoTokensMinted, uint256 extraTokensMinted)',
  'event EthRefundIssued(uint256 indexed campaignId, address indexed donor, uint256 amount)',
  'event CampaignCancelled(uint256 indexed campaignId)',
  'event Initialized(address indexed caller)',
];

// CampaignStakeToken ABI (per-campaign token)
export const STAKE_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
];

// CampaignStakeTokenFactory ABI
export const FACTORY_ABI = [
  'function deploy(uint256 campaignId, string campaignTitle, address crowdfunding) returns (address)',
  'event TokenDeployed(uint256 indexed campaignId, address tokenAddress, string name, string symbol)',
];

// ── Types ────────────────────────────────────────────────────────
export interface OnChainCampaign {
  supabaseId:    string;
  organizer:     string;
  goalAmount:    bigint;
  deadline:      bigint;
  totalRaisedEth: bigint;
  withdrawn:     boolean;
  cancelled:     boolean;
  stakeToken:    string;
  tokenSymbol:   string;
  hasExtraToken: boolean;
  extraQuantity: bigint;
  extraFdyAmount: bigint;
  extraMinDonate: bigint;
  extraAwarded:  bigint;
}

interface Web3ContextType {
  provider:       ethers.BrowserProvider | null;
  signer:         ethers.JsonRpcSigner | null;
  address:        string | null;
  chainId:        number | null;
  ethBalance:     string;
  isConnected:    boolean;
  isConnecting:   boolean;
  error:          string | null;

  connect:        () => Promise<void>;
  disconnect:     () => void;
  refreshBalance: () => Promise<void>;

  // Admin
  addAdmin:    (address: string) => Promise<void>;
  removeAdmin: (address: string) => Promise<void>;

  // Campaign
  createCampaignOnChain: (
    supabaseId:     string,
    goalEth:        string,   
    deadlineTs:     number,   
    campaignTitle:  string,
    extraQuantity:  string,   
    extraFdyAmount: string, 
    extraMinDonate: string,  
  ) => Promise<number>;

  donateEth:             (onChainId: number, amountEth: string) => Promise<any>;
  withdrawFunds:         (onChainId: number) => Promise<any>;
  claimRefund:           (onChainId: number) => Promise<any>;
  cancelCampaignOnChain: (onChainId: number) => Promise<any>;
  getCampaignOnChain:    (onChainId: number) => Promise<OnChainCampaign>;
  getDonationAmount:     (onChainId: number, donor: string) => Promise<string>;

  // Stake token helpers
  getStakeBalance:       (onChainId: number, donor: string) => Promise<string>;
  getTotalStake:         (onChainId: number) => Promise<string>;
  getEstimatedExtraCost: (onChainId: number) => Promise<string>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

// ── Balance helper ───────────────────────────────────────────────
async function getBalances(prov: ethers.BrowserProvider, addr: string) {
  const ethBal = await prov.getBalance(addr);
  return { eth: Number(ethers.formatEther(ethBal)).toFixed(4) };
}

// ── Provider ─────────────────────────────────────────────────────
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
  const [ethBalance,   setEthBalance]   = useState('0');
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const applyBalances = (bal: { eth: string }) => setEthBalance(bal.eth);

  const setConnected = (
    prov: ethers.BrowserProvider,
    sgn: ethers.JsonRpcSigner,
    addr: string,
    chain: number,
    bal: { eth: string },
  ) => {
    setProvider(prov); setSigner(sgn); setAddress(addr);
    setChainId(chain); setIsConnected(true); applyBalances(bal);
  };

  // ── Auto-reconnect to bound wallet (no popup) ──────────────────
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
  }, [boundWalletAddress, isConnected]);

  // ── Connect ────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) { setError('MetaMask not detected. Please install MetaMask.'); return; }
    setIsConnecting(true); setError(null);

    try {
      const prov = new ethers.BrowserProvider(window.ethereum);

      if (boundWalletAddress) {
        await prov.send('eth_requestAccounts', []);
        const sgn  = await prov.getSigner();
        const addr = await sgn.getAddress();
        if (addr.toLowerCase() !== boundWalletAddress.toLowerCase()) {
          setError(`Wrong wallet. Please switch MetaMask to: ${boundWalletAddress.slice(0, 10)}...${boundWalletAddress.slice(-6)}`);
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

      try {
        const msg = `Welcome to Fundy!\n\nSigning this message verifies you own this wallet.\n\nWallet: ${addr}\nTimestamp: ${Date.now()}`;
        await sgn.signMessage(msg);
      } catch (e: any) {
        if (e?.code === 4001) { setError('Please sign the message to verify wallet ownership.'); return; }
      }

      const network = await prov.getNetwork();
      const bal     = await getBalances(prov, addr);
      setConnected(prov, sgn, addr, Number(network.chainId), bal);

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
    setEthBalance('0'); setIsConnected(false); setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!provider || !address) return;
    const bal = await getBalances(provider, address);
    applyBalances(bal);
  }, [provider, address]);

  // ── MetaMask events ────────────────────────────────────────────
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

  // ── Contract getters ────────────────────────────────────────────
  const cf = useCallback((write = false) => {
    if (!provider) throw new Error('Wallet not connected');
    return new ethers.Contract(
      CONTRACT_ADDRESSES.crowdfunding,
      CROWDFUNDING_ABI,
      write ? signer! : provider,
    );
  }, [provider, signer]);

  // ── Contract actions ────────────────────────────────────────────

  const createCampaignOnChain = useCallback(async (
    supabaseId:     string,
    goalEth:        string,
    deadlineTs:     number,
    campaignTitle:  string,
    extraQuantity:  string,
    extraFdyAmount: string,
    extraMinDonate: string,
  ): Promise<number> => {
    const goalWei      = ethers.parseEther(goalEth);                      
    const extraQty     = BigInt(extraQuantity || '0');                        
    const extraFdyWei  = extraFdyAmount && extraFdyAmount !== '0'
      ? ethers.parseEther(extraFdyAmount) 
      : 0n;
    const extraMinWei  = extraMinDonate && extraMinDonate !== '0'
      ? ethers.parseEther(extraMinDonate)   // ETH → wei
      : 0n;

    const tx = await cf(true).createCampaign(
      supabaseId,
      goalWei,
      deadlineTs,
      campaignTitle,
      extraQty,
      extraFdyWei,
      extraMinWei,
    );
    const receipt = await tx.wait();

    const iface = new ethers.Interface(CROWDFUNDING_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'CampaignCreated') return Number(parsed.args.campaignId);
      } catch {}
    }
    throw new Error('CampaignCreated event not found in receipt');
  }, [cf]);

  const donateEth = useCallback(async (id: number, amtEth: string) => {
    const tx = await cf(true).donate(id, { value: ethers.parseEther(amtEth) });
    const r  = await tx.wait();
    await refreshBalance();
    return r;
  }, [cf, refreshBalance]);

  const withdrawFunds = useCallback(async (id: number) => {
    const tx = await cf(true).withdraw(id);
    return tx.wait();
  }, [cf]);

  const claimRefund = useCallback(async (id: number) => {
    const tx = await cf(true).claimRefund(id);
    return tx.wait();
  }, [cf]);

  const cancelCampaignOnChain = useCallback(async (id: number) => {
    const tx = await cf(true).cancelCampaign(id);
    return tx.wait();
  }, [cf]);

  const getCampaignOnChain = useCallback(async (id: number): Promise<OnChainCampaign> => {
    return cf().getCampaign(id);
  }, [cf]);

  const getDonationAmount = useCallback(async (id: number, donor: string): Promise<string> => {
    const wei = await cf().getEthDonation(id, donor);
    return ethers.formatEther(wei);
  }, [cf]);

  const getStakeBalance = useCallback(async (id: number, donor: string): Promise<string> => {
    const wei = await cf().stakeBalance(id, donor);
    return ethers.formatEther(wei);
  }, [cf]);

  const getTotalStake = useCallback(async (id: number): Promise<string> => {
    const wei = await cf().totalStake(id);
    return ethers.formatEther(wei);
  }, [cf]);

  const getEstimatedExtraCost = useCallback(async (id: number): Promise<string> => {
    const wei = await cf().estimatedExtraCost(id);
    return ethers.formatEther(wei);
  }, [cf]);

  const addAdmin = useCallback(async (addr: string) => {
    const tx = await cf(true).addAdmin(addr);
    await tx.wait();
  }, [cf]);

  const removeAdmin = useCallback(async (addr: string) => {
    const tx = await cf(true).removeAdmin(addr);
    await tx.wait();
  }, [cf]);

  return (
    <Web3Context.Provider value={{
      provider, signer, address, chainId, ethBalance,
      isConnected, isConnecting, error,
      connect, disconnect, refreshBalance,
      createCampaignOnChain,
      donateEth,
      withdrawFunds,
      claimRefund,
      cancelCampaignOnChain,
      getCampaignOnChain,
      getDonationAmount,
      getStakeBalance,
      getTotalStake,
      getEstimatedExtraCost,
      addAdmin,
      removeAdmin,
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

export const BATCH_TRANSFER_ABI = [
  'function disperseEther(address[] recipients, uint256[] values) external payable',
];


declare global { interface Window { ethereum?: any; } }