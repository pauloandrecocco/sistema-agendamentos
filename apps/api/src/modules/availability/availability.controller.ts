import type { AvailabilityCalendarQuery, AvailabilityDayQuery } from '@agenda/shared';
import type { Request, Response } from 'express';
import type { AvailabilityService } from './availability.service.js';

export function createAvailabilityController(availabilityService: AvailabilityService) {
  return {
    calendar: async (req: Request, res: Response) => {
      const { month } = req.query as AvailabilityCalendarQuery;
      res.json(await availabilityService.getCalendar(month));
    },

    day: async (req: Request, res: Response) => {
      const { date } = req.query as AvailabilityDayQuery;
      res.json(await availabilityService.getDay(date));
    },
  };
}

export type AvailabilityController = ReturnType<typeof createAvailabilityController>;
