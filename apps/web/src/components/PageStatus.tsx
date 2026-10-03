import { Button } from '@/components/ui/button';

export function PageLoading() {
  return <p className="text-muted-foreground py-12 text-center text-sm">Carregando…</p>;
}

export function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm">Não foi possível carregar os dados.</p>
      <Button variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
