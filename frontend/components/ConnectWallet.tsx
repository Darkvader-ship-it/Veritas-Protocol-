'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVeritas } from '@/hooks/useVeritas';
import { TIER_NAMES, TIER_COLORS } from '@/lib/contracts';
import { Wallet, ChevronDown } from 'lucide-react';
import { ProfilePopup } from './ProfilePopup';

export function ConnectWallet() {
  const { isRegistered, nftMetadata } = useVeritas();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              // Not connected - show connect button
              if (!connected) {
                return (
                  <Button
                    onClick={openConnectModal}
                    className="h-9 sm:h-10 px-4 sm:px-5 text-sm font-medium"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Connect</span>
                    <span className="sm:hidden">Connect</span>
                  </Button>
                );
              }

              // Wrong network
              if (chain.unsupported) {
                return (
                  <Button
                    onClick={openChainModal}
                    variant="destructive"
                    className="h-9 sm:h-10 px-4 text-sm font-medium"
                  >
                    Wrong Network
                  </Button>
                );
              }

              // Connected - show minimal wallet info
              return (
                <>
                  <div className="flex items-center gap-2">
                    {/* Tier Badge - only on desktop, only if registered */}
                    {isRegistered && nftMetadata && (
                      <Badge
                        className={`${TIER_COLORS[nftMetadata.tier]} text-white text-xs font-medium hidden lg:inline-flex`}
                      >
                        {TIER_NAMES[nftMetadata.tier]}
                      </Badge>
                    )}

                    {/* Wallet Button - compact */}
                    <Button
                      onClick={() => setIsProfileOpen(true)}
                      variant="outline"
                      className="h-9 sm:h-10 px-3 sm:px-4 text-sm font-medium border-border/50 hover:bg-white/5"
                    >
                      {/* Chain icon - small */}
                      {chain.hasIcon && chain.iconUrl && (
                        <div
                          className="w-4 h-4 rounded-full overflow-hidden mr-2 hidden sm:block"
                          style={{ background: chain.iconBackground }}
                        >
                          <img
                            alt=""
                            src={chain.iconUrl}
                            className="w-4 h-4"
                          />
                        </div>
                      )}
                      {/* Just the truncated address */}
                      <span className="font-mono">
                        {account.address.slice(0, 6)}...{account.address.slice(-4)}
                      </span>
                    </Button>
                  </div>

                  {/* Profile Popup Modal */}
                  <ProfilePopup
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                  />
                </>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
