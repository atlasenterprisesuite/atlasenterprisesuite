export interface NightWindow {
  timeZone: string;
  startHour: number;
  endHour: number;
}

export const DEFAULT_NIGHT_WINDOW: NightWindow = {
  timeZone: 'America/New_York',
  startHour: 23,
  endHour: 7,
};

export function localHour(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const hourPart = formatter.formatToParts(date).find((part) => part.type === 'hour');
  if (!hourPart) throw new Error(`Unable to resolve ATLAS night hour for ${timeZone}`);
  return Number(hourPart.value);
}

export function isWithinNightWindow(date: Date, window: NightWindow = DEFAULT_NIGHT_WINDOW): boolean {
  const hour = localHour(date, window.timeZone);
  if (window.startHour === window.endHour) return true;
  if (window.startHour < window.endHour) {
    return hour >= window.startHour && hour < window.endHour;
  }
  return hour >= window.startHour || hour < window.endHour;
}
