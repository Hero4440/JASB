import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// Define the linking configuration for the app
export const linking = {
  prefixes: [
    'jasb://',
    'http://localhost:3000', // For development
    Linking.createURL('/'),
  ],
  config: {
    screens: {
      index: '/',
      'auth/sign-in': '/auth/sign-in',
      'auth/sign-up': '/auth/sign-up',
      'auth/reset-password': '/auth/reset-password',
      'auth/verify': '/auth/verify',
      'auth/update-password': '/auth/update-password',
      'auth/dev-sign-in': '/auth/dev-sign-in',
      'groups/[id]/index': '/groups/:id',
      'groups/[id]/add-expense': '/groups/:id/add-expense',
      'groups/[id]/drafts/index': '/groups/:id/drafts',
      'groups/[id]/drafts/[draftId]': '/groups/:id/drafts/:draftId',
    },
  },
};

// Handle incoming URLs (especially from Supabase email links)
export const handleDeepLink = (url: string) => {
  console.log('Deep link received:', url);

  if (url.includes('/auth/v1/verify')) {
    // Parse Supabase verification URL
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type');

    if (token && type) {
      // Navigate to our verification screen with the parameters
      router.push(`/auth/verify?token=${token}&type=${type}`);
      return true;
    }
  }

  // For other deep links, let Expo Router handle them
  return false;
};

// Set up deep link listener
export const setupDeepLinking = () => {
  const subscription = Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url);
  });

  // Handle initial URL if app was opened via deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink(url);
    }
  });

  return () => {
    subscription?.remove();
  };
};
