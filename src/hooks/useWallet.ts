import { useState, useEffect, useCallback } from 'react';
import { WalletInfo } from '@/lib/index';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMetaMaskInstalled = typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;

  const loadWalletInfo = useCallback(async (address: string) => {
    if (!window.ethereum) return;
    try {
      const chainIdHex: string = await window.ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      const balanceHex: string = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      // Convert from wei to ETH (approximate, 4 decimals)
      const balanceWei = parseInt(balanceHex, 16);
      const balanceEth = (balanceWei / 1e18).toFixed(4);
      setWallet({ address, chainId, balance: balanceEth, isConnected: true });
    } catch {
      setWallet({ address, chainId: 1, balance: '0.0000', isConnected: true });
    }
  }, []);

  // Restore connection from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('fundy_wallet_address');
    if (saved && window.ethereum) {
      loadWalletInfo(saved);
    }
  }, [loadWalletInfo]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWallet(null);
        localStorage.removeItem('fundy_wallet_address');
      } else {
        loadWalletInfo(accounts[0]);
        localStorage.setItem('fundy_wallet_address', accounts[0]);
      }
    };

    const onChainChanged = () => {
      const addr = wallet?.address;
      if (addr) loadWalletInfo(addr);
    };

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener('chainChanged', onChainChanged);
    };
  }, [wallet?.address, loadWalletInfo]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed. Please install MetaMask to connect your wallet.');
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) {
        await loadWalletInfo(accounts[0]);
        localStorage.setItem('fundy_wallet_address', accounts[0]);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [loadWalletInfo]);

  const disconnect = useCallback(() => {
    setWallet(null);
    localStorage.removeItem('fundy_wallet_address');
  }, []);

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  const networkName = (chainId: number) => {
    const names: Record<number, string> = {
      1: 'Ethereum',
      5: 'Goerli',
      11155111: 'Sepolia',
      137: 'Polygon',
      80001: 'Mumbai',
    };
    return names[chainId] ?? `Chain ${chainId}`;
  };

  return {
    wallet,
    isConnecting,
    isConnected: !!wallet?.isConnected,
    isMetaMaskInstalled,
    error,
    connect,
    disconnect,
    shortAddress,
    networkName: wallet ? networkName(wallet.chainId) : null,
    clearError: () => setError(null),
  };
}
