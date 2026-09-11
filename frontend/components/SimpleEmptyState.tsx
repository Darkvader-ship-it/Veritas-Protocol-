'use client';

import { Card, CardContent } from '@/components/ui/card';

interface SimpleEmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function SimpleEmptyState({
  title,
  description,
  action,
}: SimpleEmptyStateProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
        {action && <div className="flex gap-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
