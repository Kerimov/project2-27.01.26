export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function parseIsoDate(iso: string): Date {
  if (!iso?.trim()) return new Date();
  const d = new Date(`${iso.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function parseTimeString(time: string, baseDate?: Date): Date {
  const base = baseDate ? new Date(baseDate) : new Date();
  const [h, m] = (time || '09:00').split(':').map((x) => parseInt(x, 10));
  const d = new Date(base);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function formatRuDate(iso: string): string {
  if (!iso?.trim()) return '';
  return parseIsoDate(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function toDateTimeLocalValue(isoDate: string, time: string): string {
  const date = isoDate.trim() || toIsoDate(new Date());
  const t = time.trim() || '09:00';
  return `${date}T${t}`;
}

export function splitDateTimeLocal(value: string): { date: string; time: string } {
  if (!value?.trim()) {
    const now = new Date();
    return { date: toIsoDate(now), time: toTimeString(now) };
  }
  const [date, timePart] = value.split('T');
  return { date: date || '', time: (timePart || '09:00').slice(0, 5) };
}
