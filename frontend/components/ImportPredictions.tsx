'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVeritas } from '@/hooks/useVeritas';
import { useAccount } from 'wagmi';
import { Download, Check, Loader2, TrendingUp, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface BetHistoryResponse {
  success: boolean;
  address: string;
  totalBets: number;
  correctBets: number;
  totalVolumeSTT: number;
  winRate: number;
  error?: string;
}

interface ImportState {
  status: 'idle' | 'scanning' | 'found' | 'importing' | 'success' | 'error' | 'no_bets';
  data?: BetHistoryResponse;
  calculatedScore?: number;
  error?: string;
}

export function ImportPredictions() {
  const { address } = useAccount();
  const { platforms, connectPlatform, importPredictions, isConnecting, isImporting } = useVeritas();
  const [selectedPlatform, setSelectedPlatform] = useState<bigint | null>(null);
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const [progress, setProgress] = useState(0);

  const handleConnectPlatform = async (platformId: bigint) => {
    try {
      await connectPlatform(platformId);
      setSelectedPlatform(platformId);
    } catch (error) {
      console.error('Failed to connect platform:', error);
    }
  };

  /**
   * Scan blockchain for REAL prediction history
   */
  const scanForPredictions = async () => {
    if (!address) {
      setImportState({ status: 'error', error: 'Wallet not connected' });
      return;
    }

    setImportState({ status: 'scanning' });
    setProgress(0);

    try {
      // Show progress animation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Fetch real bet history from our API
      const response = await fetch(`/api/dreamdex/history?address=${address}`);
      const data: BetHistoryResponse = await response.json();

      clearInterval(progressInterval);
      setProgress(100);

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch bet history');
      }

      if (data.totalBets === 0) {
        setImportState({ status: 'no_bets' });
        return;
      }

      setImportState({
        status: 'found',
        data,
      });
    } catch (error: any) {
      console.error('Scan error:', error);
      setImportState({
        status: 'error',
        error: error?.message || 'Failed to scan blockchain',
      });
    }
  };

  /**
   * Import predictions to the Veritas contract
   */
  const handleImport = async () => {
    if (!selectedPlatform || importState.status !== 'found' || !importState.data) return;

    setImportState(prev => ({ ...prev, status: 'importing' }));
    setProgress(0);

    try {
      const { totalBets, correctBets, totalVolumeSTT } = importState.data;

      // Show progress animation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 85));
      }, 300);

      // Generate proof hash from the data
      const proofData = `${address}-${totalBets}-${correctBets}-${totalVolumeSTT}-${Date.now()}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(proofData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const proof = ('0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;

      // Convert volume to wei (18 decimals)
      const volumeWei = BigInt(Math.floor(totalVolumeSTT * 1e18));

      // Call the contract
      await importPredictions(
        selectedPlatform,
        BigInt(totalBets),
        BigInt(correctBets),
        volumeWei,
        proof
      );

      clearInterval(progressInterval);
      setProgress(100);

      // Calculate expected VeritasScore
      const winRate = totalBets > 0 ? (correctBets / totalBets) * 100 : 0;
      const calculatedScore = Math.floor((winRate * Math.sqrt(totalVolumeSTT)) / 10);

      setImportState({
        status: 'success',
        data: importState.data,
        calculatedScore: Math.min(calculatedScore, 999), // Cap at 999
      });
    } catch (error: any) {
      console.error('Import error:', error);

      // Check for rate limit error
      if (error?.message?.includes('RateLimitExceeded')) {
        setImportState({
          status: 'error',
          error: 'Rate limit: Please wait 1 hour between imports',
        });
      } else if (error?.message?.includes('BatchAlreadyImported')) {
        setImportState({
          status: 'error',
          error: 'This prediction batch has already been imported',
        });
      } else {
        setImportState({
          status: 'error',
          error: error?.message || 'Failed to import predictions',
        });
      }
    }
  };

  const resetFlow = () => {
    setImportState({ status: 'idle' });
    setProgress(0);
  };

  const formatVolume = (stt: number) => {
    if (stt >= 1000) return `${(stt / 1000).toFixed(1)}k`;
    if (stt >= 1) return stt.toFixed(2);
    return stt.toFixed(4);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Import Predictions
        </CardTitle>
        <CardDescription>
          Import your real prediction history from DreamDEX
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Selection */}
        {!selectedPlatform && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Select Platform</p>
            {platforms.map((platform) => (
              <div
                key={platform.id.toString()}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{platform.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {platform.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleConnectPlatform(platform.id)}
                  disabled={!platform.isActive || isConnecting}
                >
                  {isConnecting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting</>
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>
            ))}

            {platforms.length === 0 && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  No platforms available. Make sure you're registered.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Ready to Scan */}
        {selectedPlatform && importState.status === 'idle' && (
          <div className="space-y-4">
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
              <Clock className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Ready to scan Somnia blockchain for your DreamDEX prediction history
              </AlertDescription>
            </Alert>
            <Button onClick={scanForPredictions} className="w-full" size="lg">
              <Download className="w-4 h-4 mr-2" />
              Scan My Wallet
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This will fetch your real bet history from DreamDEX Event Contracts
            </p>
          </div>
        )}

        {/* Scanning */}
        {importState.status === 'scanning' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Scanning blockchain for your predictions...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Querying DreamDEX Event Contracts contract on Somnia
            </p>
          </div>
        )}

        {/* No Bets Found */}
        {importState.status === 'no_bets' && (
          <div className="space-y-4">
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                No DreamDEX predictions found for your wallet. Try making some bets first!
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={resetFlow} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => window.open('https://dreamdex.finance/prediction', '_blank')}
                className="flex-1"
              >
                Go to DreamDEX
              </Button>
            </div>
          </div>
        )}

        {/* Found Predictions */}
        {importState.status === 'found' && importState.data && (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/30">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300 font-semibold">
                Found {importState.data.totalBets} real predictions on-chain!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">{importState.data.totalBets}</div>
                <div className="text-xs text-muted-foreground">Total Bets</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-green-500/10 border-green-500/30">
                <div className="text-2xl font-bold text-green-600">{importState.data.correctBets}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">{importState.data.winRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-amber-500/10 border-amber-500/30">
                <div className="text-2xl font-bold text-amber-600">
                  {formatVolume(importState.data.totalVolumeSTT)} STT
                </div>
                <div className="text-xs text-muted-foreground">Volume</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={resetFlow} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                size="lg"
                disabled={isImporting}
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import to Blockchain
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Importing */}
        {importState.status === 'importing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Importing predictions to Veritas...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Please confirm the transaction in your wallet
            </p>
          </div>
        )}

        {/* Success */}
        {importState.status === 'success' && importState.data && (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/30">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300 font-semibold">
                Successfully imported {importState.data.totalBets} predictions!
              </AlertDescription>
            </Alert>

            <div className="p-6 border-2 border-amber-500 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
              <div className="text-center space-y-2">
                <div className="text-sm text-muted-foreground">Your VeritasScore</div>
                <div className="text-5xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  {importState.calculatedScore}
                </div>
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                  NFT Updated
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="font-semibold">{importState.data.totalBets}</div>
                <div className="text-muted-foreground">Predictions</div>
              </div>
              <div>
                <div className="font-semibold text-green-600">{importState.data.winRate.toFixed(1)}%</div>
                <div className="text-muted-foreground">Win Rate</div>
              </div>
              <div>
                <div className="font-semibold">{formatVolume(importState.data.totalVolumeSTT)} STT</div>
                <div className="text-muted-foreground">Volume</div>
              </div>
            </div>

            <Button onClick={resetFlow} variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Import More
            </Button>
          </div>
        )}

        {/* Error */}
        {importState.status === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{importState.error}</AlertDescription>
            </Alert>
            <Button onClick={resetFlow} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {/* Rate Limit Info */}
        {selectedPlatform && importState.status !== 'error' && (
          <p className="text-xs text-muted-foreground text-center">
            Rate limit: 1 hour between imports | Data sourced from Somnia blockchain
          </p>
        )}
      </CardContent>
    </Card>
  );
}
