import { Redirect } from 'expo-router';

export default function MedicationsTabRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/diary', params: { section: 'medications' } }} />;
}
