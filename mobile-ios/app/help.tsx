import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppSection } from '@/components/ui/AppSection';

const FAQ = [
  {
    q: 'Не могу войти',
    a: 'Проверьте email и пароль. Тест: seed@example.com / seed1234. Убедитесь, что Next.js запущен (npm run dev).',
  },
  {
    q: 'Документы не распознаются',
    a: 'Запустите Ollama (ollama serve) и модель llava для изображений. Дождитесь статуса «обработан» в списке документов.',
  },
  {
    q: 'Мобильное приложение не подключается',
    a: 'Телефон и компьютер в одной Wi‑Fi. В Expo Go URL API должен быть https://... или IP Mac с портом 3000.',
  },
  {
    q: 'Где данные хранятся',
    a: 'В SQLite/PostgreSQL на сервере проекта. Регулярно делайте бэкап базы в продакшене.',
  },
];

export default function HelpScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <AppSection title="Помощь и FAQ">
        <AppCard variant="surface2" style={{ marginBottom: theme.spacing.md }}>
          <AppText variant="body">
            Медицинский ассистент PMA — хранение анализов, документов, записей и AI-подсказок. Не заменяет консультацию врача.
          </AppText>
        </AppCard>
        {FAQ.map((item) => (
          <AppCard key={item.q} style={{ marginBottom: theme.spacing.sm }}>
            <AppText variant="h3">{item.q}</AppText>
            <AppText variant="body" color="mutedText" style={{ marginTop: theme.spacing.xs }}>
              {item.a}
            </AppText>
          </AppCard>
        ))}
      </AppSection>
    </AppScreen>
  );
}
