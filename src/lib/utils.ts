import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export function formatNum(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(Number(num))) return '--';
  return Number(num).toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function readUriAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) {
      const parts = uri.split(',');
      if (parts.length > 1) {
        return parts[1];
      }
    }
    
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
  }
}
