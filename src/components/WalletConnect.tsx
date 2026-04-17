import React, { useEffect } from 'react';
import { Wallet, LogOut, Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWeb3 } from '@/context/Web3Context';
import { useAuth } from '@/hooks/useAuth';

export function WalletConnect() {
  const { isConnected, isConnecting, address, fdyBalance, ethBalance, chainId, connect, disconnect, error } = useWeb3();
  const { user } = useAuth();

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // Ganache default chainId is 1337 or 5777
  const isCorrectNetwork = chainId === 1337 || chainId === 5777;

  if (isConnecting) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" onClick={connect} className="gap-2">
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
        {error && <p className="text-xs text-destructive max-w-[200px] text-right">{error}</p>}
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <Button variant="destructive" size="sm" onClick={connect} className="gap-2">
        <Wallet className="w-4 h-4" />
        Wrong Network
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/30">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs">{shortAddress}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground">Connected Wallet</p>
          <p className="font-mono text-xs font-semibold truncate">{address}</p>
        </div>
        <DropdownMenuSeparator />
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⟠</span>
            <div>
              <p className="text-xs text-muted-foreground">ETH Balance</p>
              <p className="text-sm font-bold">{ethBalance} ETH</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">FDY Balance</p>
              <p className="text-sm font-bold">{Number(fdyBalance).toLocaleString()} FDY</p>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive cursor-pointer"
          onClick={disconnect}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
