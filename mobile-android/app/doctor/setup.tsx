import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';

import { createDoctorProfile } from '../../api/doctor';
import { useAppTheme } from '@/design/tokens';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSection } from '@/components/ui/AppSection';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';

const SPECIALIZATIONS: Array<{ id: string; label: string }> = [
  { id: 'general', label: 'Терапевт' },
  { id: 'cardiology', label: 'Кардиолог' },
  { id: 'neurology', label: 'Невролог' },
  { id: 'endocrinology', label: 'Эндокринолог' },
  { id: 'gastroenterology', label: 'Гастроэнтеролог' },
  { id: 'pulmonology', label: 'Пульмонолог' },
  { id: 'dermatology', label: 'Дерматолог' },
  { id: 'ophthalmology', label: 'Офтальмолог' },
  { id: 'otolaryngology', label: 'ЛОР' },
  { id: 'urology', label: 'Уролог' },
  { id: 'gynecology', label: 'Гинеколог' },
  { id: 'pediatrics', label: 'Педиатр' },
  { id: 'psychiatry', label: 'Психиатр' },
  { id: 'other', label: 'Другое' },
];

export default function DoctorSetupScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('general');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [clinic, setClinic] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    const lic = licenseNumber.trim();
    const edu = education.trim();
    const exp = Number(experience);

    if (!lic) {
      Alert.alert('Ошибка', 'Укажите номер лицензии');
      return;
    }
    if (!edu) {
      Alert.alert('Ошибка', 'Укажите образование');
      return;
    }
    if (!Number.isFinite(exp) || exp < 0 || exp > 60) {
      Alert.alert('Ошибка', 'Опыт должен быть числом (0–60)');
      return;
    }

    try {
      setLoading(true);
      await createDoctorProfile({
        licenseNumber: lic,
        specialization,
        experience: exp,
        education: edu,
        clinic: clinic.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      Alert.alert('Готово', 'Профиль врача создан.', [
        {
          text: 'OK',
          onPress: () => router.replace('/doctor' as any),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось создать профиль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <AppSection title="Профиль врача" subtitle="Заполните данные один раз, чтобы открыть кабинет врача">
        <AppCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
          <AppInput label="Номер лицензии *" value={licenseNumber} onChangeText={setLicenseNumber} />

          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="bodyStrong">Специализация *</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPECIALIZATIONS.map((s) => (
                <AppChip
                  key={s.id}
                  label={s.label}
                  tone={specialization === s.id ? 'primary' : 'neutral'}
                  onPress={() => setSpecialization(s.id)}
                />
              ))}
            </View>
          </View>

          <AppInput
            label="Опыт (лет) *"
            value={experience}
            onChangeText={setExperience}
            keyboardType="numeric"
            placeholder="Напр. 7"
          />
          <AppInput
            label="Образование *"
            value={education}
            onChangeText={setEducation}
            placeholder="ВУЗ, факультет, год"
          />

          <AppInput label="Клиника" value={clinic} onChangeText={setClinic} />
          <AppInput label="Телефон" value={phone} onChangeText={setPhone} />
          <AppInput label="Адрес" value={address} onChangeText={setAddress} />

          <AppButton title="Сохранить" loading={loading} onPress={onSave} fullWidth />
          <AppButton title="Отмена" variant="secondary" onPress={() => router.back()} fullWidth />
        </AppCard>
      </AppSection>
    </AppScreen>
  );
}

