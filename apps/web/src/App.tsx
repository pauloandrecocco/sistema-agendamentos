import { BUSINESS_TIMEZONE, type HealthResponse } from '@agenda/shared';
import { useEffect, useState } from 'react';

type ApiState = 'loading' | 'ok' | 'error';

const apiLabels: Record<ApiState, string> = {
  loading: 'verificando…',
  ok: 'ok',
  error: 'indisponível',
};

export function App() {
  const [apiState, setApiState] = useState<ApiState>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        const body = (await res.json()) as HealthResponse;
        setApiState(res.ok && body.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => setApiState('error'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Sistema de Agendamentos</h1>
      <p>Fuso de negócio: {BUSINESS_TIMEZONE}</p>
      <p>API: {apiLabels[apiState]}</p>
    </main>
  );
}
