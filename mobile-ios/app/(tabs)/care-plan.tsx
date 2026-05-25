import { Redirect } from 'expo-router';

export default function CarePlanTabRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/diary', params: { section: 'plan' } }} />;
}
