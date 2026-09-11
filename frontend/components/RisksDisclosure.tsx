'use client';

import { AlertTriangle, Shield, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RisksDisclosure() {
  return (
    <div className="space-y-4">
      <Alert className="border-warning/30 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Trading involves significant risk</AlertTitle>
        <AlertDescription>Only trade with funds you can afford to lose. DeFi is non-custodial but has technical and market risks.</AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Technical</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• Smart contracts may have undiscovered bugs — see Audits.</p>
            <p>• Somnia downtime/congestion can block place/cancel/fill.</p>
            <p>• SpotPool/StopRegistry are upgradeable beacons (owner-controlled).</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Market</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• Thin books → wide spreads, large orders slip.</p>
            <p>• Market/IOC fills across levels — avg may be worse than top.</p>
            <p>• Use limit to cap worst price.</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Protocol</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• Upgrades can change logic/params (tick/lot/min, fees).</p>
            <p>• 0% fees funded by USDso ~3.3% yield to makers.</p>
            <p>• Changes announced when possible.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
