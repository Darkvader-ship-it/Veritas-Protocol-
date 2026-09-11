'use client'


import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVeritas } from '@/hooks/useVeritas';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectWallet } from '@/components/ConnectWallet';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useHomePlatformStats, useCaseStudyTrader } from '@/lib/queries';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

import {
  ArrowRight,
  Shield,
  TrendingUp,
  Trophy,
  CheckCircle2,
  BarChart3,
  Loader2,
  ChevronDown,
  Globe,
  Activity,
  Lock,
  ExternalLink,
  Copy,
  Sparkles,
  Users,
  Zap,
  BookOpen,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import { PlatformLogo, PLATFORMS } from '@/components/PlatformLogo';
import { shortenAddress, formatNumber, TIER_STYLES, getTierFromScore } from '@/components/ui/design-tokens';

// Types now imported from queries.ts

const getTierInfo = (score: number) => {
  const tier = getTierFromScore(score);
  const styles = TIER_STYLES[tier];
  return { name: styles.name, color: styles.color, bg: styles.bg, border: styles.border };
};

export default function HomePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isRegistered, registerUser, isRegistering } = useVeritas();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const caseStudyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedWinRate, setAnimatedWinRate] = useState(0);
  const [animatedBets, setAnimatedBets] = useState(0);

  // React Query hooks - automatic caching and deduplication
  const { data: statsData } = useHomePlatformStats();
  const { data: caseStudyTrader } = useCaseStudyTrader();
  const [topTradersLoading, setTopTradersLoading] = useState(true);
  const [topTraders, setTopTraders] = useState<{ address: string; username?: string; winRate: number; totalBets: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dreamdex-leaderboard?limit=3');
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.data)) {
          setTopTraders(data.data);
        }
      } catch (error) {
        // No fallback — show empty state until a real trader exists
      } finally {
        if (!cancelled) setTopTradersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Use query data with fallbacks
  const stats = statsData ?? {
    totalTraders: 0,
    totalPredictions: 0,
    totalVolumeSTT: 0,
    totalVolumeUSD: 0,
    supportedChains: 3,
  };

  // Case study animations - simplified and robust
  useEffect(() => {
    if (typeof window === 'undefined' || !caseStudyTrader) return;

    // Use a ref-like check to prevent re-running
    let hasRun = false;

    const ctx = gsap.context(() => {
      // Card reveal with scroll trigger
      ScrollTrigger.create({
        trigger: caseStudyRef.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          if (hasRun) return;
          hasRun = true;

          // Card fade in
          gsap.fromTo(
            cardRef.current,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
          );

          const scoreTarget = caseStudyTrader.veritasScore;
          const winRateTarget = caseStudyTrader.winRate;
          const betsTarget = caseStudyTrader.totalBets;

          gsap.to({ val: 0 }, {
            val: scoreTarget,
            duration: 1.5,
            delay: 0.3,
            ease: 'power2.out',
            onUpdate: function() {
              setAnimatedScore(Math.round(this.targets()[0].val));
            },
          });

          gsap.to({ val: 0 }, {
            val: winRateTarget,
            duration: 1.5,
            delay: 0.4,
            ease: 'power2.out',
            onUpdate: function() {
              setAnimatedWinRate(Math.round(this.targets()[0].val * 10) / 10);
            },
          });

          gsap.to({ val: 0 }, {
            val: betsTarget,
            duration: 1.8,
            delay: 0.5,
            ease: 'power2.out',
            onUpdate: function() {
              setAnimatedBets(Math.round(this.targets()[0].val));
            },
          });
        },
      });
    }, caseStudyRef);

    return () => ctx.revert();
  }, [caseStudyTrader]);

  // Hero score - initialize to final value so user never sees 0
  const heroScore = 847;

  const handleGetStarted = () => {
    if (!isConnected) return;
    if (isRegistered) {
      router.push('/dashboard');
    } else {
      registerUser();
    }
  };

  return (
    <div className="flex flex-col">
      {/* ═══════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden noise-overlay">
        {/* Background layers: static gradient + subtle dot grid */}
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-dot-grid opacity-30" />

        <div className="container relative px-5 md:px-6 py-16 md:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 xl:gap-20 items-center">

              {/* Text Content */}
              <div className="text-center lg:text-left mb-12 lg:mb-0">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                  <Sparkles className="h-3.5 w-3.5" />
                  On-chain verification
                </div>

                {/* Headline with gradient */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                  Your predictions.
                  <span className="block mt-2">
                    <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">Verified.</span>{' '}
                    <span className="bg-gradient-to-r from-secondary via-amber-400 to-yellow-400 bg-clip-text text-transparent">Valuable.</span>
                  </span>
                </h1>

                {/* Subheadline */}
                <p className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0 leading-relaxed mb-8">
                  Build your on-chain reputation across 7 prediction markets.
                  No fake screenshots. Just immutable blockchain data.
                </p>

                {/* CTA Buttons - no wallet-dependent states to avoid jarring flashes */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                  <Button
                    size="lg"
                    onClick={() => router.push('/leaderboard')}
                    className="h-12 px-6 shadow-lg shadow-primary/20"
                  >
                    View Leaderboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => router.push('/traders')}
                    className="h-12 px-6"
                  >
                    Explore Traders
                  </Button>
                </div>

                {/* Social Proof */}
                <div className="flex items-center justify-center lg:justify-start gap-3">
                  <div className="flex -space-x-2">
                    {['T', 'P', 'C', 'A'].map((letter, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border-2 border-background flex items-center justify-center text-xs font-bold"
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {stats.totalTraders > 0 ? stats.totalTraders.toLocaleString() : '700+'}
                    </span>{' '}traders verified
                  </p>
                </div>
              </div>

              {/* Hero Card - with proper shadow elevation */}
              <div className="w-full max-w-sm mx-auto lg:max-w-md">
                <div className="relative">
                  {/* Card with verification glow border effect */}
                  <div className="relative rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-black/5 verification-glow">
                    {/* Trophy badge - personality element */}
                    <div className="absolute -top-3 -right-3 w-14 h-14 rounded-xl bg-gradient-to-br from-secondary to-amber-600 flex items-center justify-center shadow-lg rotate-3">
                      <Trophy className="h-7 w-7 text-white" />
                    </div>

                    {/* Profile header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-md">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-mono text-sm">0x7a3f...8e2d</p>
                        <Badge className="mt-0.5 bg-slate-300/10 text-slate-300 border-slate-300/20 text-xs">
                          Platinum
                        </Badge>
                      </div>
                    </div>

                    {/* Score display */}
                    <div className="text-center py-6 mb-6 rounded-xl bg-surface/50 border border-border">
                      <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent tabular-nums">
                        {heroScore.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">VeritasScore</p>
                      <div className="flex items-center justify-center gap-1.5 text-success text-sm font-medium mt-2">
                        <TrendingUp className="h-3.5 w-3.5" />
                        +127 this week
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Win Rate', value: '58.2%', color: 'text-success' },
                        { label: 'Predictions', value: '127', color: 'text-foreground' },
                        { label: 'Volume', value: '4.2 STT', color: 'text-secondary' },
                      ].map((stat, i) => (
                        <div key={i} className="text-center p-3 rounded-lg bg-surface/30 border border-border">
                          <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data stream accent line */}
      <div className="data-stream" />

      {/* ═══════════════════════════════════════════════════════════════
          SOCIAL PROOF BAR - Two-row Marquee (opposite directions)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-8 border-y border-border bg-surface/30 overflow-hidden">
        <div className="text-center mb-5 px-5">
          <p className="text-lg font-medium">
            Tracking{' '}
            <span className="text-secondary font-bold">
              {stats.totalTraders > 0 ? stats.totalTraders.toLocaleString() : '700+'}
            </span>{' '}traders across{' '}
            <span className="text-primary font-bold">7</span>{' '}prediction markets
          </p>
        </div>

        {/* Desktop: Single row marquee */}
        <div className="relative hidden md:block">
          {/* Fade edges - desktop only */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[hsl(225,18%,10%)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[hsl(225,18%,10%)] to-transparent z-10 pointer-events-none" />

          <div className="flex animate-marquee">
            {[...PLATFORMS, ...PLATFORMS].map((platform, i) => (
              <div
                key={`desktop-${platform.id}-${i}`}
                className="flex items-center gap-2 px-4 py-2.5 mx-1.5 rounded-lg bg-card border border-border shadow-sm shrink-0"
              >
                <PlatformLogo platform={platform.id} size="sm" />
                <span className="text-sm font-medium whitespace-nowrap">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Two rows, opposite directions, no fade edges */}
        <div className="md:hidden space-y-2">
          {/* Row 1: First 4 platforms (3x duplication) */}
          <div className="flex animate-marquee-3x">
            {(() => {
              const row1 = PLATFORMS.slice(0, 4);
              return [...row1, ...row1, ...row1].map((platform, i) => (
                <div
                  key={`mobile-row1-${platform.id}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 mx-1 rounded-lg bg-card border border-border shadow-sm shrink-0"
                >
                  <PlatformLogo platform={platform.id} size="xs" />
                  <span className="text-xs font-medium whitespace-nowrap">{platform.name}</span>
                </div>
              ));
            })()}
          </div>

          {/* Row 2: Last 4 platforms (3x duplication, reverse direction) */}
          <div className="flex animate-marquee-3x-reverse">
            {(() => {
              const row2 = PLATFORMS.slice(3, 7);
              return [...row2, ...row2, ...row2].map((platform, i) => (
                <div
                  key={`mobile-row2-${platform.id}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 mx-1 rounded-lg bg-card border border-border shadow-sm shrink-0"
                >
                  <PlatformLogo platform={platform.id} size="xs" />
                  <span className="text-xs font-medium whitespace-nowrap">{platform.name}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="container px-5 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
              <p className="text-muted-foreground">Three steps to build your verifiable reputation</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Connect wallet',
                  description: 'Link your wallet and mint a soulbound NFT for 0.0005 STT (~$0.30).',
                  icon: Shield,
                  color: 'text-primary',
                  bg: 'bg-primary/10',
                },
                {
                  step: '2',
                  title: 'Auto-import history',
                  description: 'We fetch your trading history from all 7 supported platforms automatically.',
                  icon: Activity,
                  color: 'text-success',
                  bg: 'bg-success/10',
                },
                {
                  step: '3',
                  title: 'Build your score',
                  description: 'Your VeritasScore updates with every trade. Climb the leaderboard.',
                  icon: Trophy,
                  color: 'text-secondary',
                  bg: 'bg-secondary/10',
                },
              ].map((item) => (
                <div key={item.step} className="relative p-6 rounded-xl border border-border bg-card shadow-sm">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-md">
                    {item.step}
                  </div>
                  <div className={`w-12 h-12 mb-4 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CASE STUDY - Real Trader
          ═══════════════════════════════════════════════════════════════ */}
      <section ref={caseStudyRef} className="relative py-20 md:py-28 bg-surface/50 overflow-hidden">
        {/* Subtle dot grid in case study too */}
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div className="container relative px-5 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-secondary/10 text-secondary border-secondary/20">
                <Zap className="w-3 h-3 mr-1" />
                Live data
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Meet{' '}
                <span className="bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent">
                  {caseStudyTrader?.username || 'a top trader'}
                </span>
              </h2>
              <p className="text-muted-foreground">
                One of the highest-ranked traders on Veritas — 100% verified
              </p>
            </div>

            {caseStudyTrader && (
              <div ref={cardRef} className="max-w-md mx-auto opacity-0">
                <div className="relative rounded-2xl border border-success/30 bg-card p-6 shadow-xl shadow-black/10 verification-glow">
                  {/* Status indicator */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Verified</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="text-[10px] font-medium text-success uppercase tracking-wide">Live</span>
                    </div>
                  </div>

                  {/* Profile */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg ring-2 ring-success/50 ring-offset-2 ring-offset-background">
                      {caseStudyTrader.username?.[0] || '?'}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{caseStudyTrader.username || 'Anonymous'}</h3>
                      <p className="text-sm text-muted-foreground font-mono">
                        {shortenAddress(caseStudyTrader.address)}
                      </p>
                    </div>
                    <Badge className={`${getTierInfo(caseStudyTrader.veritasScore).bg} ${getTierInfo(caseStudyTrader.veritasScore).color} ${getTierInfo(caseStudyTrader.veritasScore).border}`}>
                      {getTierInfo(caseStudyTrader.veritasScore).name}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                      <p className="text-2xl font-bold text-secondary tabular-nums">
                        {animatedScore.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">VeritasScore</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-success/10 border border-success/20">
                      <p className="text-2xl font-bold text-success tabular-nums">
                        {animatedWinRate}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Win Rate</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-2xl font-bold text-primary tabular-nums">
                        {formatNumber(animatedBets)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total Bets</p>
                    </div>
                  </div>

                  {/* Verification badge */}
                  <div className="mt-6 pt-6 border-t border-success/20 flex items-center justify-center gap-2 text-sm text-success">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-success/20 verified-pulse">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Every bet verified on the blockchain</span>
                  </div>
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex justify-center gap-3 mt-8">
              <Link href="/copy-trading">
                <Button variant="outline" size="lg" className="h-11">
                  Try simulation
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" className="h-11 shadow-md shadow-primary/20">
                  View leaderboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          WHY VERIFICATION MATTERS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="container px-5 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why verification matters</h2>
              <p className="text-muted-foreground">In prediction markets, proof beats claims</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Problem */}
              <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                    <span className="text-destructive font-bold">✕</span>
                  </div>
                  <p className="font-semibold text-destructive">The problem</p>
                </div>
                <ul className="space-y-3">
                  {[
                    'No way to prove prediction accuracy',
                    'History scattered across platforms',
                    'Anyone can fake screenshots',
                    'Self-reported stats are unreliable',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="text-destructive mt-0.5">×</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Solution */}
              <div className="p-6 rounded-2xl border border-success/20 bg-success/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <p className="font-semibold text-success">The solution</p>
                </div>
                <ul className="space-y-3">
                  {[
                    'VeritasScore proves your accuracy algorithmically',
                    'Unified history from all 7 platforms',
                    'Soulbound NFT that can\'t be faked or transferred',
                    'Every stat verifiable on-chain',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          COPY TRADING PREVIEW
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-surface/50">
        <div className="container px-5 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  <Copy className="h-3 w-3 mr-1" />
                  Coming soon
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Copy top traders
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Follow verified traders automatically. Set your risk limits and
                  mirror positions from top performers in real-time.
                </p>

                <ul className="space-y-3 mb-8">
                  {[
                    'Follow traders with 60%+ verified win rates',
                    'Set position limits and daily caps',
                    'Test with simulation mode first',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Button onClick={() => router.push('/copy-trading')} className="h-11 shadow-md shadow-primary/20">
                  Try simulation
                </Button>
              </div>

              {/* Preview card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/5">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="font-semibold">Top traders to copy</p>
                    <p className="text-sm text-muted-foreground">Verified on DreamDEX</p>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
                    Live
                  </Badge>
                </div>

                {topTradersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 rounded-xl bg-surface/50 border border-border animate-pulse">
                        <div className="h-4 w-2/3 bg-surface-raised rounded" />
                      </div>
                    ))}
                  </div>
                ) : topTraders.length === 0 ? (
                  <div className="rounded-xl bg-surface/50 border border-border p-6 text-center">
                    <p className="text-sm font-semibold">No traders yet</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Be the first — place a trade and build your reputation.
                    </p>
                    <Button onClick={() => router.push('/dreamdex')} variant="outline" size="sm">
                      Start trading
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topTraders.map((trader, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-border">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-sm font-bold">
                          {trader.username?.[0]?.toUpperCase() ?? 'T'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{trader.username || shortenAddress(trader.address)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{trader.totalBets} bets</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-success">{trader.winRate >= 100 ? Math.round(trader.winRate) : trader.winRate.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Win rate</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          VERITASSCORE EXPLANATION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="container px-5 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-secondary/10 text-secondary border-secondary/20">Algorithm</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                <span className="bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent">VeritasScore</span>
              </h2>
              <p className="text-muted-foreground">Your algorithmic reputation based on verified blockchain data</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Calculation */}
              <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                <h3 className="font-semibold text-lg mb-4">How it's calculated</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Win Rate', weight: '60%', desc: 'Your prediction accuracy', color: 'text-success' },
                    { label: 'Volume', weight: '25%', desc: 'Total amount traded', color: 'text-primary' },
                    { label: 'Consistency', weight: '15%', desc: 'Regular trading activity', color: 'text-secondary' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className={`w-14 text-right font-bold ${item.color}`}>{item.weight}</div>
                      <div className="flex-1">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
                  Maximum possible score: <span className="font-semibold text-foreground">1300</span>
                </div>
              </div>

              {/* Tiers */}
              <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                <h3 className="font-semibold text-lg mb-4">Reputation tiers</h3>
                <div className="space-y-3">
                  {[
                    { name: 'Diamond', range: '900+', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { name: 'Platinum', range: '650-899', color: 'text-slate-300', bg: 'bg-slate-300/10' },
                    { name: 'Gold', range: '400-649', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                    { name: 'Silver', range: '200-399', color: 'text-gray-400', bg: 'bg-gray-400/10' },
                    { name: 'Bronze', range: '0-199', color: 'text-orange-500', bg: 'bg-orange-500/10' },
                  ].map((tier, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-20 px-2 py-1 rounded-md ${tier.bg} text-center`}>
                        <span className={`text-sm font-semibold ${tier.color}`}>{tier.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{tier.range} points</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Lock, title: 'Soulbound NFT', desc: 'Non-transferable, truly yours' },
                { icon: BarChart3, title: 'Global leaderboard', desc: 'Compete with top traders' },
                { icon: Globe, title: '7 platforms', desc: 'Unified prediction history' },
              ].map((feature, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card shadow-sm text-center">
                  <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          TRUST / TRANSPARENCY
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-surface/50">
        <div className="container px-5 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">100% transparent</h2>
            <p className="text-muted-foreground mb-12">Every score is verifiable on-chain. No trust required.</p>

            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              {[
                { title: 'Open source', desc: 'All contracts are public', Icon: BookOpen, link: 'https://github.com/veritas' },
                { title: 'On-chain', desc: 'Scores stored on Somnia', Icon: Link2, link: null },
                { title: 'Non-custodial', desc: 'We never hold your funds', Icon: ShieldCheck, link: null },
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                  <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                    <item.Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{item.desc}</p>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary inline-flex items-center gap-1 font-medium"
                    >
                      View code <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <p className="text-success font-medium">
              <CheckCircle2 className="h-4 w-4 inline mr-2" />
              Zero fees on your actual trading
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="container px-5 md:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Common questions</h2>

            <div className="space-y-3">
              {[
                {
                  q: 'How much does it cost?',
                  a: 'Minting your reputation NFT costs 0.0005 STT (~$0.30). All features are free after that. We don\'t take any cut of your trades.',
                },
                {
                  q: 'Which platforms are supported?',
                  a: 'DreamDEX Event Contracts (live on-chain), Azuro, and SX Bet. More coming soon.',
                },
                {
                  q: 'How is VeritasScore calculated?',
                  a: 'Win rate (60%), volume (25%), and consistency (15%). Max score is 1300. Uses Wilson Score to prevent gaming with many small bets.',
                },
                {
                  q: 'Can I transfer my VeritasScore?',
                  a: 'No. VeritasScore is a soulbound NFT — it\'s permanently tied to your wallet. This ensures authenticity and prevents reputation selling.',
                },
              ].map((faq, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <span className="font-medium">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-200 ${openFaq === i ? 'max-h-40' : 'max-h-0'}`}>
                    <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-surface/50 to-background">
        <div className="container px-5 md:px-6">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start building your reputation</h2>
            <p className="text-muted-foreground mb-8">
              {stats.totalTraders > 0
                ? `Join ${stats.totalTraders.toLocaleString()} traders with verified records`
                : 'Join traders building verifiable track records'
              }
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => router.push('/leaderboard')}
                className="h-12 px-8 shadow-lg shadow-primary/20"
              >
                View Leaderboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>

              {!isConnected ? (
                <ConnectWallet />
              ) : !isRegistered && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleGetStarted}
                  disabled={isRegistering}
                  className="h-12 px-8"
                >
                  {isRegistering ? 'Minting...' : 'Get Started Free'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
