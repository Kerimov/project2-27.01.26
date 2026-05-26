import React from 'react';
import { useSegments } from 'expo-router';

import { AIChat } from '@/components/AIChat';
import { useAuthStore } from '../state/authStore';
import { useAiChatLaunchStore } from '../state/aiChatLaunchStore';

export function GlobalAIChat() {
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const initialDocumentIds = useAiChatLaunchStore((s) => s.initialDocumentIds);
  const autoOpen = useAiChatLaunchStore((s) => s.autoOpen);

  const root = segments[0];
  const isAuthScreen = String(root) === 'index' || String(root) === 'register';
  const aboveTabBar = root === '(tabs)';

  if (isBootstrapping || !token || isAuthScreen) return null;

  return (
    <AIChat
      initialDocumentIds={initialDocumentIds}
      autoOpen={autoOpen}
      aboveTabBar={aboveTabBar}
    />
  );
}
