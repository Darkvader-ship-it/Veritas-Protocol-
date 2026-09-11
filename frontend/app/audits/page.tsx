import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Shield } from 'lucide-react';

export default function AuditsPage() {
  return (
    <div className="container px-4 md:px-6 py-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Audits</h1>
        <p className="text-sm text-muted-foreground">Security is prioritized via internal testing, external audits, and bug bounty. Built on Somnia L1.</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Somnia Inherited Practices</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Smart Contract Security guidelines</p>
          <p>• Audit checklists & verification</p>
          <p>• Infrastructure security & responsible disclosure</p>
          <a href="https://docs.somnia.network/security" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Somnia Security Docs <ExternalLink className="h-3 w-3" /></a>
        </CardContent>
      </Card>

      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Spot Protocol — Hacken (April 2026)</CardTitle>
            <Badge className="bg-success text-white">Complete</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><span className="font-medium">Firm:</span> Hacken</p>
          <p><span className="font-medium">Scope:</span> OrderBook, SpotPool, SpotStopOrderRegistry, ERC20Vault, PriorityIndex, OrderIndexManager, PerUserOrderIndex, LinkedList, Common</p>
          <p><span className="font-medium">Coverage:</span> Matching, order lifecycle, vault (native), fees, mark-price EMA, reactivity for stops</p>
          <a href="https://hacken.io/audits/somnia" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Hacken report <ExternalLink className="h-3 w-3" /></a>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">USDso Swap — Sherlock (separate)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>USDso (FraxUSD via LayerZero, quote across spot) swap contract under separate Sherlock audit. See Roadmap.</p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Future Audits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Additional audits before major upgrades — firms/scopes will be listed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
