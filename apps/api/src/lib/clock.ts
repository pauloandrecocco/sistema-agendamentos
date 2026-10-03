/** Source of "now", injected into services so tests can freeze time. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
