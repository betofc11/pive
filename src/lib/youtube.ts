import { Linking } from 'react-native';

// Opens the YouTube app directly, or falls back to the browser
export const openYouTubeSearch = async (query: string) => {
  const encodedQuery = encodeURIComponent(query);
  const appUrl = `youtube://results?search_query=${encodedQuery}`;
  const webUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening YouTube:', error);
    await Linking.openURL(webUrl);
  }
};
