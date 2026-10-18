const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime12h = (time24?: string | null): string => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(m)} ${ampm}`;
};

export const split24hTo12h = (time24: string): { hour12: number; minute: number; ampm: 'AM' | 'PM' } => {
  const [hStr, mStr] = (time24 || '09:00').split(':');
  const h24 = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;
  return { hour12: (h24 % 12) || 12, minute, ampm: h24 >= 12 ? 'PM' : 'AM' };
};

export const to24hString = (hour12: number, minute: number, ampm: 'AM' | 'PM'): string => {
  const h = (hour12 % 12) + (ampm === 'PM' ? 12 : 0);
  return `${pad(h)}:${pad(minute)}`;
};

export const getNext5MinuteSlot = (fromDate: Date = new Date()): string => {
  const d = new Date(fromDate);
  const remainder = d.getMinutes() % 5;
  d.setMinutes(d.getMinutes() + (remainder === 0 ? 5 : 5 - remainder), 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
