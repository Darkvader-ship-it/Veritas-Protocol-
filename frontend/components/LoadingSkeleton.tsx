'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Dashboard Loading Skeleton
export function DashboardSkeleton() {
  return (
    <div className="container py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>

      {/* Bottom Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Skeleton className="h-[350px] rounded-lg" />
        <Skeleton className="h-[350px] rounded-lg" />
      </div>
    </div>
  );
}

// VeritasScore Card Skeleton
export function VeritasScoreCardSkeleton() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Skeleton className="h-32 w-full" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-2 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-20" />
      </CardContent>
    </Card>
  );
}

// NFT Display Skeleton
export function NFTDisplaySkeleton() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Leaderboard Table Skeleton
export function LeaderboardTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24 ml-auto" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

// Import Flow Skeleton
export function ImportFlowSkeleton() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Generic Card Skeleton
export function CardSkeleton() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </CardContent>
    </Card>
  );
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  );
}

// Transaction Progress Skeleton
export function TransactionProgressSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>
  );
}
