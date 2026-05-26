import { Alert, Linking, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export type PhoneReminderPayload = {
  title: string;
  notes?: string;
  dueAt: Date;
};

export type PhoneTransferItem = {
  title?: unknown;
  description?: unknown;
  dueAt?: unknown;
  dueInDays?: unknown;
};

function defaultDueFromTask(dueAt?: string | null): Date {
  if (dueAt) {
    const d = new Date(dueAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function buildDueAtFromForm(datePart: string, timePart: string): Date {
  const date = datePart.trim() || new Date().toISOString().slice(0, 10);
  const time = timePart.trim() || '09:00';
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function normalizePhoneReminderItem(item: PhoneTransferItem, fallbackTitle = 'Задача PMA'): PhoneReminderPayload {
  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : fallbackTitle;
  const notes = typeof item.description === 'string' && item.description.trim() ? item.description.trim() : undefined;
  let dueAt: Date | null = null;
  if (typeof item.dueAt === 'string' || item.dueAt instanceof Date) {
    const d = new Date(item.dueAt);
    if (!Number.isNaN(d.getTime())) dueAt = d;
  }
  if (!dueAt && typeof item.dueInDays === 'number') {
    dueAt = new Date(Date.now() + Math.max(0, item.dueInDays) * 24 * 60 * 60 * 1000);
  }
  return { title, notes, dueAt: dueAt || defaultDueFromTask(null) };
}

async function pickWritableEventCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  return writable?.id ?? calendars[0]?.id ?? null;
}

export async function addReminderToPhone(payload: PhoneReminderPayload): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS !== 'android') {
    return { ok: false, error: 'Доступно только на Android' };
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, error: 'Нет доступа к календарю Android' };
    }

    const calendarId = await pickWritableEventCalendarId();
    if (!calendarId) return { ok: false, error: 'Не найден календарь Android для записи' };

    const start = new Date(payload.dueAt);
    if (start.getTime() < Date.now()) start.setTime(Date.now() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    await Calendar.createEventAsync(calendarId, {
      title: payload.title.slice(0, 200),
      notes: payload.notes?.slice(0, 2000),
      startDate: start,
      endDate: end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: [{ relativeOffset: -15 }],
    });

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Не удалось создать событие в календаре Android' };
  }
}

async function addManyToPhone(items: PhoneReminderPayload[]) {
  const results = await Promise.all(items.map((item) => addReminderToPhone(item)));
  return results.filter((r) => r.ok).length;
}

function showPhoneError(error: string, onDone?: () => void) {
  Alert.alert('Календарь Android', error, [
    { text: 'Закрыть', style: 'cancel', onPress: onDone },
    { text: 'Настройки', onPress: () => Linking.openSettings().then(() => onDone?.()) },
  ]);
}

export function promptAddToPhoneAfterReminderSaved(payload: PhoneReminderPayload, onDone?: () => void) {
  Alert.alert('Календарь Android', 'Добавить это напоминание также в календарь Android с уведомлением?', [
    { text: 'Не сейчас', style: 'cancel', onPress: onDone },
    {
      text: 'Добавить',
      onPress: async () => {
        const res = await addReminderToPhone(payload);
        if (res.ok) {
          Alert.alert('Готово', 'Событие добавлено в календарь Android.', [{ text: 'OK', onPress: onDone }]);
        } else {
          showPhoneError(res.error || 'Ошибка', onDone);
        }
      },
    },
  ]);
}

export function promptAddReminderForCarePlanTask(
  params: {
    title: string;
    description?: string;
    dueAt?: string | null;
    createAppReminder: () => Promise<void>;
  },
  onDone: () => void
) {
  const phonePayload: PhoneReminderPayload = {
    title: params.title,
    notes: params.description || 'Задача из плана действий PMA',
    dueAt: defaultDueFromTask(params.dueAt),
  };

  Alert.alert('Напоминание к задаче', 'Создать напоминание в PMA и перенести его в календарь Android?', [
    { text: 'Пропустить', style: 'cancel', onPress: onDone },
    {
      text: 'Только PMA',
      onPress: async () => {
        try {
          await params.createAppReminder();
          Alert.alert('Готово', 'Напоминание создано в приложении.', [{ text: 'OK', onPress: onDone }]);
        } catch (e: unknown) {
          Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось', [{ text: 'OK', onPress: onDone }]);
        }
      },
    },
    {
      text: 'PMA + Android',
      onPress: async () => {
        try {
          await params.createAppReminder();
          const res = await addReminderToPhone(phonePayload);
          const msg = res.ok
            ? 'Напоминание создано в PMA и календаре Android.'
            : `Напоминание в PMA создано. Android: ${res.error || 'ошибка'}.`;
          Alert.alert(res.ok ? 'Готово' : 'Частично готово', msg, [{ text: 'OK', onPress: onDone }]);
        } catch (e: unknown) {
          Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось', [{ text: 'OK', onPress: onDone }]);
        }
      },
    },
  ]);
}

export function promptTransferCreatedItemsToPhone(
  items: PhoneReminderPayload[],
  options?: { title?: string; message?: string; onDone?: () => void }
) {
  if (items.length === 0) {
    if (options?.title || options?.message) {
      Alert.alert(options?.title || 'Готово', options?.message || 'Нет задач для переноса.', [
        { text: 'OK', onPress: options?.onDone },
      ]);
      return;
    }
    options?.onDone?.();
    return;
  }
  Alert.alert(
    options?.title || 'Перенести в Android',
    options?.message || `Добавить ${items.length} задач/напоминаний в календарь Android с уведомлениями?`,
    [
      { text: 'Не сейчас', style: 'cancel', onPress: options?.onDone },
      {
        text: 'Добавить',
        onPress: async () => {
          const count = await addManyToPhone(items);
          Alert.alert('Готово', `Добавлено: ${count} из ${items.length}.`, [{ text: 'OK', onPress: options?.onDone }]);
        },
      },
    ]
  );
}
