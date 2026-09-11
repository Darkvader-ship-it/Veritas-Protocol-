/**
 * Copy Chain Visualizer
 * Shows the copy trading chain for a wallet
 */

import { ChevronRight, User, Copy, Shield, AlertTriangle } from 'lucide-react';

interface CopyChainNode {
  address: string;
  depth: number;
  tier?: string;
  score?: number;
}

interface CopyChainVisualizerProps {
  chain: CopyChainNode[];
  currentAddress?: string;
}

const TIER_CLASSES: Record<string, string> = {
  DIAMOND: 'tier-diamond',
  PLATINUM: 'tier-platinum',
  GOLD: 'tier-gold',
  SILVER: 'tier-silver',
  BRONZE: 'tier-bronze',
};

export function CopyChainVisualizer({ chain, currentAddress }: CopyChainVisualizerProps) {
  if (chain.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-text-secondary">
        <Shield className="w-5 h-5 mr-2" />
        No copy chain data
      </div>
    );
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="space-y-3">
      {/* Chain Header */}
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
        <span>Copy depth: {chain.length > 0 ? chain[chain.length - 1].depth : 0}</span>
        {chain.length > 1 && (
          <span className="px-2 py-0.5 rounded text-xs bg-warning/20 text-warning">
            Cascade detected
          </span>
        )}
      </div>

      {/* Chain Visualization */}
      <div className="flex flex-wrap items-center gap-2">
        {chain.map((node, index) => (
          <div key={node.address} className="flex items-center gap-2">
            {/* Node */}
            <div
              className={`
                relative p-3 rounded-lg border transition-all
                ${node.address.toLowerCase() === currentAddress?.toLowerCase()
                  ? 'border-primary bg-primary/10'
                  : node.depth === 0
                    ? 'border-success bg-success/10'
                    : 'border-border bg-surface-raised'
                }
              `}
            >
              {/* Depth Badge */}
              <div className={`
                absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${node.depth === 0 ? 'bg-success text-white' : 'bg-border text-text-primary'}
              `}>
                {node.depth}
              </div>

              {/* Icon */}
              <div className="flex items-center gap-2">
                {node.depth === 0 ? (
                  <User className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4 text-text-secondary" />
                )}

                {/* Address & Info */}
                <div>
                  <div className="font-mono text-sm">{formatAddress(node.address)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {node.tier && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${TIER_CLASSES[node.tier] || ''}`}>
                        {node.tier}
                      </span>
                    )}
                    {node.score !== undefined && (
                      <span className="text-xs text-secondary font-semibold">
                        {node.score}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="text-xs text-text-secondary mt-1">
                {node.depth === 0 ? 'Original' : `Copy (depth ${node.depth})`}
              </div>
            </div>

            {/* Arrow */}
            {index < chain.length - 1 && (
              <ChevronRight className="w-5 h-5 text-text-secondary flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Warning for deep chains */}
      {chain.length > 2 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 mt-4">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-warning">Deep copy chain detected</div>
            <div className="text-text-secondary mt-1">
              This trader is {chain.length - 1} levels deep in the copy chain.
              Copy trading from deep chains can result in delayed executions and worse prices.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CopyChainVisualizer;
