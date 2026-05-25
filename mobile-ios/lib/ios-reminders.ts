import { Alert, Linking, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export type IOSReminderPayload = {
  title: string;
  notes?: string;
  dueAt: Date;
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

async function pickWritableReminderCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
  const writable = calendars.find((c) => c.allowsModifications);
  return writable?.id ?? calendars[0]?.id ?? null;
}

export async function addReminderToIOS(payload: IOSReminderPayload): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS !== 'ios') {
    return { ok: false, error: 'Доступно только на iPhone' };
  }

  try {
    const { status } = await Calendar.requestRemindersPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, error: 'Нет доступа к приложению «Напоминания»' };
    }

    const calendarId = await pickWritableReminderCalendarId();
    const due = payload.dueAt;
    const start = new Date(due);
    if (start.getTime() < Date.now()) {
      start.setTime(Date.now() + 5 * 60 * 1000);
    }

    await Calendar.createReminderAsync(calendarId, {
      title: payload.title.slice(0, 200),
      notes: payload.notes?.slice(0, 2000),
      dueDate: start,
      startDate: start,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: [{ relativeOffset: -15 }],
    });

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Не удалось создать напоминание в iOS';
    return { ok: false, error: msg };
  }
}

function showIOSError(error: string, onDone?: () => void) {
  Alert.alert('Напоминания iPhone', error, [
    { text: 'Закрыть', style: 'cancel', onPress: onDone },
    { text: 'Настройки', onPress: () => Linking.openSettings().then(() => onDone?.()) },
  ]);
}

/** После сохранения напоминания в PMA — предложить дублировать в «Напоминания» iOS. */
export function promptAddToIOSAfterReminderSaved(payload: IOSReminderPayload, onDone?: () => void) {
  if (Platform.OS !== 'ios') {
    onDone?.();
    return;
  }

  Alert.alert(
    'Напоминания iPhone',
    'Добавить это напоминание также в приложение «Напоминания» на iPhone?',
    [
      { text: 'Не сейчас', style: 'cancel', onPress: onDone },
      {
        text: 'Добавить в iOS',
        onPress: async () => {
          const res = await addReminderToIOS(payload);
          if (res.ok) {
            Alert.alert('Готово', 'Напоминание добавлено в «Напоминания» iPhone.', [{ text: 'OK', onPress: onDone }]);
          } else {
            showIOSError(res.error || 'Ошибка', onDone);
          }
        },
      },
    ]
  );
}

/** После создания задачи плана — предложить напоминание в PMA и/или iOS. */
export function promptAddReminderForCarePlanTask(
  params: {
    title: string;
    description?: string;
    dueAt?: string | null;
    createAppReminder: () => Promise<void>;
  },
  onDone: () => void
) {
  const iosPayload: IOSReminderPayload = {
    title: params.title,
    notes: params.description || 'Задача из плана действий PMA',
    dueAt: defaultDueFromTask(params.dueAt),
  };

  if (Platform.OS !== 'ios') {
    Alert.alert('Напоминание к задаче', 'Создать напоминание в приложении для этой задачи?', [
      { text: 'Пропустить', style: 'cancel', onPress: onDone },
      {
        text: 'Создать',
        onPress: async () => {
          try {
            await params.createAppReminder();
            Alert.alert('Готово', 'Напоминание создано в приложении.', [{ text: 'OK', onPress: onDone }]);
          } catch (e: unknown) {
            Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось создать напоминание', [
              { text: 'OK', onPress: onDone },
            ]);
          }
        },
      },
    ]);
    return;
  }

  Alert.alert(
    'Напоминание к задаче',
    'Создать напоминание в приложении PMA и при желании в «Напоминаниях» iPhone?',
    [
      { text: 'Пропустить', style: 'cancel', onPress: onDone },
      {
        text: 'Только в приложении',
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
        text: 'Приложение + iPhone',
        onPress: async () => {
          try {
            await params.createAppReminder();
            const res = await addReminderToIOS(iosPayload);
            if (res.ok) {
              Alert.alert('Готово', 'Напоминание в приложении и в «Напоминаниях» iPhone.', [
                { text: 'OK', onPress: onDone },
              ]);
            } else {
              Alert.alert(
                'Частично готово',
                `Напоминание в приложении создано. iOS: ${res.error || 'ошибка'}.`,
                [{ text: 'OK', onPress: onDone }]
              );
            }
          } catch (e: unknown) {
            Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось', [{ text: 'OK', onPress: onDone }]);
          }
        },
      },
      {
        text: 'Только iPhone',
        onPress: async () => {
          const res = await addReminderToIOS(iosPayload);
          if (res.ok) {
            Alert.alert('Готово', 'Напоминание добавлено в «Напоминания» iPhone.', [{ text: 'OK', onPress: onDone }]);
          } else {
            showIOSError(res.error || 'Ошибка', onDone);
          }
        },
      },
    ]
  );
}
