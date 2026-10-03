/** Temporary page for screens delivered in later phases (PRD 19). */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="grid gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <p className="text-muted-foreground text-sm">Disponível na próxima fase.</p>
    </section>
  );
}
