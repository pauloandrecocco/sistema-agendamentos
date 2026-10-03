import type {
  AppointmentStatus,
  CancelledBy,
  DayAvailabilityStatus,
  DisplayStatus,
  Role,
} from './enums.js';

export type HealthResponse = { status: 'ok' };

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export type UserResponse = { user: PublicUser };

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'SLOT_ALREADY_BOOKED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'SLOT_IN_PAST'
  | 'SLOT_NOT_AVAILABLE'
  | 'APPOINTMENT_ALREADY_CANCELLED'
  | 'APPOINTMENT_ALREADY_STARTED'
  | 'INVALID_DATE'
  | 'INTERNAL_ERROR';

/** Field errors: field path (e.g. "email") -> messages. */
export type FieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

/** Working hours of one weekday (0 = Sunday ... 6 = Saturday); times are "HH:mm". */
export type WorkingHours = {
  weekday: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
};

/** Slot duration + weekly working hours (7 rows, ordered by weekday). */
export type ScheduleConfig = {
  slotDurationMinutes: number;
  workingHours: WorkingHours[];
};

/** Instants are ISO 8601 UTC strings. */
export type SlotDto = { startAt: string; endAt: string };

export type AvailabilityCalendarResponse = {
  month: string;
  days: { date: string; status: DayAvailabilityStatus }[];
};

export type AvailabilityResponse = {
  date: string;
  slotDurationMinutes: number;
  slots: SlotDto[];
};

/** Appointment as returned by the API; instants are ISO 8601 UTC strings. */
export type AppointmentDto = {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  displayStatus: DisplayStatus;
  cancelledBy: CancelledBy | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type AppointmentResponse = { appointment: AppointmentDto };

export type AppointmentListResponse = { items: AppointmentDto[] };
