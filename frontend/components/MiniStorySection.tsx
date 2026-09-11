'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Shield, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { shortenAddress, formatNumber } from '@/components/ui/design-tokens';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface TraderData {
  address: string;
  username?: string;
  veritasScore: number;
  winRate: number;
  totalBets: number;
}

export function MiniStorySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const [trader, setTrader] = useState<TraderData | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedWinRate, setAnimatedWinRate] = useState(0);
  const [animatedBets, setAnimatedBets] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Fetch trader data
  useEffect(() => {
    async function fetchTrader() {
      try {
        const res = await fetch('/api/dreamdex-leaderboard?limit=1');
        const data = await res.json();
        if (data.success && data.data?.[0]) {
          setTrader(data.data[0]);
        }
      } catch (error) {
        // No fallback — hide trader until a real one exists
      }
    }
    fetchTrader();
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (typeof window === 'undefined' || !trader) return;

    const ctx = gsap.context(() => {
      // Card entrance animation
      gsap.fromTo(
        cardRef.current,
        {
          scale: 0.8,
          opacity: 0,
          y: 60,
          rotateX: 15
        },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            end: 'top 25%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      // Stats animation trigger
      ScrollTrigger.create({
        trigger: statsRef.current,
        start: 'top 70%',
        onEnter: () => {
          if (!hasAnimated && trader) {
            setHasAnimated(true);

            // Animate score
            gsap.to({ val: 0 }, {
              val: trader.veritasScore,
              duration: 2,
              ease: 'power2.out',
              onUpdate: function() {
                setAnimatedScore(Math.round(this.targets()[0].val));
              },
            });

            // Animate win rate
            gsap.to({ val: 0 }, {
              val: trader.winRate,
              duration: 2,
              ease: 'power2.out',
              onUpdate: function() {
                setAnimatedWinRate(Math.round(this.targets()[0].val * 10) / 10);
              },
            });

            // Animate bets
            gsap.to({ val: 0 }, {
              val: trader.totalBets,
              duration: 2.5,
              ease: 'power2.out',
              onUpdate: function() {
                setAnimatedBets(Math.round(this.targets()[0].val));
              },
            });
          }
        },
        once: true,
      });

      // Stats cards stagger animation
      gsap.fromTo(
        '.mini-story-stat',
        { scale: 0.93, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: statsRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      // Badge and text animations
      gsap.fromTo(
        '.mini-story-text',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.15,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );

    }, sectionRef);

    return () => ctx.revert();
  }, [trader, hasAnimated]);

  if (!trader) return null;

  return (
    <section
      ref={sectionRef}
      className="py-20 sm:py-28 relative overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-secondary/10 to-primary/10 rounded-full blur-[150px]" />

      <div className="container px-5 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center mb-10">
            <Badge className="mini-story-text mb-4 bg-secondary/10 text-secondary border-secondary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Live case study
            </Badge>
            <h2 className="mini-story-text text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
              Meet{' '}
              <span className="bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent">
                {trader.username || 'a verified trader'}
              </span>
            </h2>
            <p className="mini-story-text text-lg text-muted-foreground">
              One of the top performers on Polymarket
            </p>
          </div>

          {/* Trader Card */}
          <div
            ref={cardRef}
            className="relative max-w-lg mx-auto mb-10"
            style={{ perspective: '1000px' }}
          >
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/20 via-secondary/20 to-indigo-600/20 rounded-[2rem] blur-2xl opacity-70" />

            <div className="relative rounded-2xl border border-white/10 bg-surface/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
              {/* Card Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30">
                  {trader.username?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{trader.username || 'Anonymous'}</h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {shortenAddress(trader.address)}
                  </p>
                </div>
                <Badge className="bg-cyan-500 text-white border-0">
                  Diamond
                </Badge>
              </div>

              {/* Stats Grid */}
              <div ref={statsRef} className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="mini-story-stat text-center p-4 sm:p-5 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20">
                  <p className="text-2xl sm:text-3xl font-bold text-secondary">
                    {animatedScore.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">VeritasScore</p>
                </div>
                <div className="mini-story-stat text-center p-4 sm:p-5 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
                  <p className="text-2xl sm:text-3xl font-bold text-success">
                    {animatedWinRate}%
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Win Rate</p>
                </div>
                <div className="mini-story-stat text-center p-4 sm:p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <p className="text-2xl sm:text-3xl font-bold text-primary">
                    {formatNumber(animatedBets)}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Total Bets</p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="mini-story-text text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success">
                Every bet verified on the blockchain
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="mini-story-text text-center">
            <Link href="/leaderboard">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 gap-2 group border-secondary/30 hover:border-secondary/50 hover:bg-secondary/5"
              >
                <span>Experience the full story</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
