import type { Router } from 'expo-router';

const ROUTE_MAP: Record<string, string> = {
  '/analyses': '/(tabs)/analyses',
  '/documents': '/(tabs)/documents',
  '/appointments': '/(tabs)/appointments',
  '/my-appointments': '/(tabs)/appointments',
  '/reminders': '/(tabs)/reminders',
  '/diary': '/(tabs)/diary',
};

export function openAssistantLink(router: Router, link: string, onClose?: () => void) {
  if (!link) return;
  onClose?.();

  if (link.startsWith('/analysis/')) {
    router.push(link as any);
    return;
  }
  if (link.startsWith('/document/')) {
    router.push(link as any);
    return;
  }

  if (link.startsWith('/diary?')) {
    const query = link.split('?')[1] || '';
    const tab = new URLSearchParams(query).get('tab') || 'entries';
    router.push({ pathname: '/(tabs)/diary', params: { section: tab } } as any);
    return;
  }

  const base = link.split('?')[0];
  router.push((ROUTE_MAP[base] || base) as any);
}
