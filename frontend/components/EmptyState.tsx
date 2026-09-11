'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground opacity-50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
        {(action || secondaryAction) && (
          <div className="flex gap-2">
            {action && (
              <Button onClick={action.onClick} className="gap-2">
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button onClick={secondaryAction.onClick} variant="outline">
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Specific empty state variants
export function NoPredictionsEmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
        <div className="text-4xl">📊</div>
      </div>
      <h3 className="text-xl font-semibold mb-2">No Predictions Yet</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Import your prediction history from supported platforms to build your VeritasScore
      </p>
      <Button
        onClick={onImport}
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      >
        Import Predictions
      </Button>
    </div>
  );
}

export function NoPlatformsEmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
        <div className="text-4xl">🔗</div>
      </div>
      <h3 className="text-xl font-semibold mb-2">No Platforms Connected</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Connect to prediction market platforms to start importing your history
      </p>
      <Button
        onClick={onConnect}
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      >
        Connect Platform
      </Button>
    </div>
  );
}

export function NoUsersEmptyState() {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
        <div className="text-4xl">🏆</div>
      </div>
      <h3 className="text-xl font-semibold mb-2">No Users Registered Yet</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Be the first to register and claim your spot on the leaderboard!
      </p>
    </div>
  );
}

export function NoResultsEmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <div className="text-4xl">🔍</div>
      </div>
      <h3 className="text-xl font-semibold mb-2">No Results Found</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        No users found matching <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{searchQuery}</code>
      </p>
    </div>
  );
}
