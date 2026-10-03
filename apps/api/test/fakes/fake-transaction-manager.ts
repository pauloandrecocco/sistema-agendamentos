import type { TransactionManager, TxRepositories } from '../../src/lib/transaction-manager.js';

/** Just runs `fn` with the in-memory repositories (no real transaction or lock). */
export class FakeTransactionManager implements TransactionManager {
  constructor(private readonly repos: TxRepositories) {}

  run<T>(fn: (repos: TxRepositories) => Promise<T>): Promise<T> {
    return fn(this.repos);
  }
}
