'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TIER_NAMES, TIER_COLORS, ReputationTier } from '@/lib/contracts';
import { useEffect, useState } from 'react';
import { Share2, Download, Check, Image as ImageIcon, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NFTDisplayProps {
  tokenURI: string;
  tier: ReputationTier;
  veritasScore: bigint;
  tokenId?: bigint;
  isLoading?: boolean;
}

export function NFTDisplay({ tokenURI, tier, veritasScore, tokenId, isLoading }: NFTDisplayProps) {
  const [svgData, setSvgData] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!tokenURI || isLoading) return;

    try {
      // Decode base64 JSON
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const jsonData = JSON.parse(atob(base64Data));
      setMetadata(jsonData);

      // Extract SVG from image data
      if (jsonData.image) {
        const svgBase64 = jsonData.image.replace('data:image/svg+xml;base64,', '');
        const decodedSvg = atob(svgBase64);
        setSvgData(decodedSvg);
      }
    } catch (error) {
      console.error('Failed to decode NFT data:', error);
    }
  }, [tokenURI, isLoading]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/nft/${tokenId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadSVG = () => {
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veritas-nft-${tokenId}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Downloaded!',
      description: 'NFT image saved to your device',
    });
  };

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-6">
          <Skeleton className="w-full aspect-square rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const tierName = TIER_NAMES[tier];
  const tierColor = TIER_COLORS[tier];

  return (
    <Card className="border-2 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Reputation NFT
          </CardTitle>
          <Badge className={`${tierColor} text-white`}>{tierName}</Badge>
        </div>
        {tokenId && (
          <p className="text-xs text-muted-foreground">Token ID: #{tokenId.toString()}</p>
        )}
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* NFT Image */}
        <div className="relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-purple-900 border-2 border-border shadow-2xl">
          {svgData ? (
            <div
              dangerouslySetInnerHTML={{ __html: svgData }}
              className="w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <div className="text-center text-white p-6">
                <div className="text-7xl font-bold mb-3 drop-shadow-lg">
                  {Number(veritasScore).toLocaleString()}
                </div>
                <div className="text-2xl font-semibold mb-2">{tierName}</div>
                <Badge className="bg-white/20 backdrop-blur-sm border-white/30">
                  <Lock className="w-3 h-3 mr-1" />
                  Soulbound NFT
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        {metadata && (
          <div className="space-y-3">
            <div>
              <p className="font-bold text-lg">{metadata.name}</p>
              <p className="text-sm text-muted-foreground">{metadata.description}</p>
            </div>

            {/* Soulbound Badge */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Soulbound Token</p>
                <p className="text-xs text-muted-foreground">
                  Non-transferable, bound to your wallet
                </p>
              </div>
            </div>

            {/* Attributes Grid */}
            {metadata.attributes && (
              <div className="grid grid-cols-2 gap-2">
                {metadata.attributes.map((attr: any, index: number) => (
                  <div key={index} className="bg-muted/50 rounded-lg p-3 border">
                    <p className="text-xs text-muted-foreground mb-1">{attr.trait_type}</p>
                    <p className="font-bold text-sm">{attr.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleShare}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {copied ? (
              <><Check className="w-4 h-4 mr-2" /> Copied!</>
            ) : (
              <><Share2 className="w-4 h-4 mr-2" /> Share</>
            )}
          </Button>
          {svgData && (
            <Button
              onClick={handleDownloadSVG}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
