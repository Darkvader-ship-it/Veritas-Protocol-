'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, User, Mail, Twitter, Wallet } from 'lucide-react';
import Link from 'next/link';
import { debounce } from 'lodash';

interface SearchResult {
  address: string;
  username?: string;
  email?: string;
  twitter?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
  rank?: number;
}

interface TraderSearchProps {
  onSelect?: (address: string) => void;
  placeholder?: string;
}

export function TraderSearch({ onSelect, placeholder = "Search by name, email, Twitter, or wallet address..." }: TraderSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const searchTraders = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/traders/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await res.json();

        if (data.success) {
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (query) {
      searchTraders(query);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query, searchTraders]);

  const handleSelect = (address: string) => {
    setShowResults(false);
    setQuery('');
    if (onSelect) {
      onSelect(address);
    }
  };

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (query.length >= 2) && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-[400px] overflow-y-auto border-border/50 shadow-lg">
          <CardContent className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No traders found matching "{query}"
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result) => (
                  <Link
                    key={result.address}
                    href={`/profile/${result.address}`}
                    onClick={() => handleSelect(result.address)}
                    className="block"
                  >
                    <div className="p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {result.username ? (
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm">{result.username}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-xs text-muted-foreground">
                                {result.address.slice(0, 6)}...{result.address.slice(-4)}
                              </span>
                            </div>
                          )}

                          {/* Social handles */}
                          <div className="flex items-center gap-3 mt-1">
                            {result.twitter && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Twitter className="h-3 w-3" />
                                @{result.twitter}
                              </div>
                            )}
                            {result.email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {result.email}
                              </div>
                            )}
                          </div>
                        </div>

                        {result.rank && (
                          <Badge variant="outline" className="text-xs">
                            #{result.rank}
                          </Badge>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-primary font-semibold">
                          {result.veritasScore} pts
                        </span>
                        <span className={result.winRate >= 55 ? 'text-success' : 'text-muted-foreground'}>
                          {result.winRate.toFixed(1)}% WR
                        </span>
                        <span className="text-muted-foreground">
                          {result.totalBets} bets
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
