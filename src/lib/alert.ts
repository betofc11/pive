import { Alert as RNAlert, Platform } from 'react-native';

export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
  ) => {
    if (Platform.OS === 'web') {
      if (!buttons || buttons.length === 0) {
        window.alert(title + (message ? `\n\n${message}` : ''));
      } else if (buttons.length === 1) {
        window.alert(title + (message ? `\n\n${message}` : ''));
        if (buttons[0].onPress) buttons[0].onPress();
      } else {
        // Normally, find the cancel button vs the main action button
        const confirmButton = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];
        const cancelButton = buttons.find(b => b.style === 'cancel') || buttons[0];
        
        const result = window.confirm(title + (message ? `\n\n${message}` : ''));
        if (result) {
          if (confirmButton && confirmButton.onPress) confirmButton.onPress();
        } else {
          if (cancelButton && cancelButton.onPress) cancelButton.onPress();
        }
      }
    } else {
      RNAlert.alert(title, message, buttons);
    }
  }
};
