import type {
  BlockDatesData,
  BlockDatesResponse,
  ScheduleConfigData,
  ScheduleConfigResponse,
  UnblockDatesResponse,
} from '@agenda/shared';
import type { Request, Response } from 'express';
import type { ScheduleService } from './schedule.service.js';

export function createScheduleController(scheduleService: ScheduleService) {
  return {
    getConfig: async (_req: Request, res: Response) => {
      res.json((await scheduleService.getConfig()) satisfies ScheduleConfigResponse);
    },

    updateConfig: async (req: Request, res: Response) => {
      const config = req.body as ScheduleConfigData;
      res.json((await scheduleService.updateConfig(config)) satisfies ScheduleConfigResponse);
    },

    block: async (req: Request, res: Response) => {
      const { dates } = req.body as BlockDatesData;
      res.json((await scheduleService.block(dates)) satisfies BlockDatesResponse);
    },

    unblock: async (req: Request, res: Response) => {
      const { dates } = req.body as BlockDatesData;
      res.json((await scheduleService.unblock(dates)) satisfies UnblockDatesResponse);
    },
  };
}

export type ScheduleController = ReturnType<typeof createScheduleController>;
