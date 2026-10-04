import { Alert as RNAlert, Platform } from 'react-native';

export interface AlertButtonConfig {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

type Listener = (title: string, message: string | undefined, buttons: AlertButtonConfig[]) => void;
let listener: Listener | null = null;

export function registerAlertListener(fn: Listener | null): void {
  listener = fn;
}

/**
 * Drop-in replacement for React Native's Alert.alert.
 * react-native-web's Alert.alert is a no-op, so on web this routes
 * through AppAlertHost (a Modal-based dialog) instead.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButtonConfig[]): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons as any);
    return;
  }
  const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  if (listener) {
    listener(title, message, resolvedButtons);
  } else {
    window.alert(message ? `${title}\n\n${message}` : title);
  }
}
