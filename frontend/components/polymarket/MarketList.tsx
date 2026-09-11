'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketCard } from './MarketCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PolymarketMarket } from '@/lib/polymarket';
import { Search, TrendingUp, RefreshCw, BarChart3, X } from 'lucide-react';

interface MarketListProps {
  onSelectMarket?: (market: PolymarketMarket) => void;
  onSimulateMarket?: (market: PolymarketMarket) => void;
  limit?: number;
  showSearch?: boolean;
  defaultView?: 'trending' | 'active';
}

interface SearchResult {
  id: string;
  question: string;
  eventTitle?: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate?: string;
  image?: string;
  slug?: string;
}

export function MarketList({
  onSelectMarket,
  onSimulateMarket,
  limit = 24,
  showSearch = true,
}: MarketListProps) {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadMarkets = useCallback(async (query: string = '', refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Use the new search API that fetches ALL markets
      const url = `/api/polymarket/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url);

      const data = await res.json();

      // Check for API error response (success: false or non-ok status)
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to fetch markets from Polymarket API');
      }

      setTotalResults(data.total || 0);

      // Transform to PolymarketMarket format
      const transformed: PolymarketMarket[] = (data.markets || []).map((m: SearchResult) => ({
        id: m.id,
        question: m.question,
        description: m.eventTitle,
        outcomes: m.outcomes || ['Yes', 'No'],
        outcomePrices: m.prices?.map(String) || ['0.5', '0.5'],
        volume: String(m.volume || 0),
        volumeNum: m.volume || 0,
        volume24hr: m.volume24hr || 0,
        liquidityNum: m.liquidity || 0,
        active: true,
        closed: false,
        archived: false,
        marketSlug: m.slug || '',
        endDate: m.endDate || null,
        gameStartTime: null,
        questionID: m.id,
        clobTokenIds: [],
        conditionId: m.id,
        enableOrderBook: true,
        orderPriceMinTickSize: 0.01,
        orderMinSize: 1,
        acceptingOrders: true,
        negRisk: false,
      }));

      setMarkets(transformed);
    } catch (err: any) {
      console.error('Error loading markets:', err);
      setError(err.message || 'Failed to load markets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    loadMarkets(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    loadMarkets('');
  };

  if (loading && !refreshing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadMarkets(searchQuery, true)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {showSearch && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search 2900+ markets... (bitcoin, trump, ethereum, AI, sports...)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 h-10"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button type="submit" className="h-10">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button
            type="button"
            onClick={() => loadMarkets(searchQuery, true)}
            disabled={refreshing}
            variant="outline"
            size="icon"
            className="h-10 w-10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </form>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {searchQuery ? (
            <>
              <Badge variant="secondary" className="text-xs">
                "{searchQuery}"
              </Badge>
              <span className="text-sm text-muted-foreground">
                {totalResults} results
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>Trending markets (sorted by 24h volume)</span>
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Showing {markets.length} of {totalResults}
        </span>
      </div>

      {/* Market Cards */}
      {markets.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {searchQuery ? `No markets found for "${searchQuery}"` : 'No markets available'}
            </p>
            {searchQuery && (
              <Button variant="link" size="sm" onClick={clearSearch} className="mt-2">
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <MarketCard
              key={market.id || market.conditionId}
              market={market}
              onSelect={onSelectMarket}
              onSimulate={onSimulateMarket}
            />
          ))}
        </div>
      )}
    </div>
  );
}
