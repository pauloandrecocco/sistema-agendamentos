import type { ScheduleConfig } from '@agenda/shared';
import type {
  BlockedDateRepository,
  ScheduleRepository,
} from '../../src/modules/schedule/schedule.repository.js';
import { defaultScheduleConfig } from '../fixtures/schedule.js';

export class InMemoryScheduleRepository implements ScheduleRepository {
  config: ScheduleConfig = defaultScheduleConfig();

  getScheduleConfig(): Promise<ScheduleConfig> {
    return Promise.resolve(structuredClone(this.config));
  }

  saveScheduleConfig(config: ScheduleConfig): Promise<void> {
    this.config = structuredClone(config);
    return Promise.resolve();
  }
}

export class InMemoryBlockedDateRepository implements BlockedDateRepository {
  readonly dates = new Set<string>();

  exists(date: string): Promise<boolean> {
    return Promise.resolve(this.dates.has(date));
  }

  findInRange(from: string, to: string): Promise<string[]> {
    return Promise.resolve([...this.dates].filter((date) => date >= from && date <= to).sort());
  }

  addMany(dates: string[]): Promise<void> {
    for (const date of dates) this.dates.add(date);
    return Promise.resolve();
  }

  removeMany(dates: string[]): Promise<void> {
    for (const date of dates) this.dates.delete(date);
    return Promise.resolve();
  }
}
