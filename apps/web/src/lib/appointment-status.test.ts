import { describe, expect, it } from 'vitest';
import { getStatusLabel } from './appointment-status';

describe('getStatusLabel', () => {
  it('labels confirmed and completed', () => {
    expect(getStatusLabel({ displayStatus: 'CONFIRMED', cancelledBy: null }, 'CLIENT')).toBe(
      'Confirmado',
    );
    expect(getStatusLabel({ displayStatus: 'COMPLETED', cancelledBy: null }, 'CLIENT')).toBe(
      'Concluído',
    );
  });

  it('tells the client who cancelled', () => {
    expect(getStatusLabel({ displayStatus: 'CANCELLED', cancelledBy: 'CLIENT' }, 'CLIENT')).toBe(
      'Cancelado por você',
    );
    expect(getStatusLabel({ displayStatus: 'CANCELLED', cancelledBy: 'ADMIN' }, 'CLIENT')).toBe(
      'Cancelado pelo estabelecimento',
    );
  });

  it('tells the admin who cancelled', () => {
    expect(getStatusLabel({ displayStatus: 'CANCELLED', cancelledBy: 'CLIENT' }, 'ADMIN')).toBe(
      'Cancelado pelo cliente',
    );
  });
});
