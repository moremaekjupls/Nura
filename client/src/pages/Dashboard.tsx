import React from 'react';
import { Card } from '@/components/ui/card';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-primary">Дашборд</h1>
        </div>
      </header>

      <main className="container py-6">
        <Card className="border-dashed p-10 text-center">
          <div className="text-5xl mb-3">🛠️</div>
          <p className="text-foreground font-semibold mb-1">Дашборд временно убран</p>
          <p className="text-sm text-muted-foreground">
            Старые графики плохо вписывались в новый дизайн — переделываем их с нуля.
          </p>
        </Card>
      </main>
    </div>
  );
}
