import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../lib/alert';

export interface WorkoutFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** Files (PDF, text or photos) picked to extract a workout plan from. */
export function useWorkoutFiles(onError: (message: string) => void) {
  const [files, setFiles] = useState<WorkoutFile[]>([]);

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setFiles(prev => [...prev, {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream'
        }]);
      }
    } catch (err) {
      console.error('Error picking document', err);
      onError('No se pudo seleccionar el archivo.');
    }
  };

  const pickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newFiles = res.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `imagen_${Date.now()}_${index}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg'
        }));
        setFiles(prev => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error('Error picking images', err);
      onError('No se pudieron seleccionar las imágenes.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la cámara.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newFile = {
          uri: res.assets[0].uri,
          name: `foto_${Date.now()}.jpg`,
          mimeType: res.assets[0].mimeType || 'image/jpeg'
        };
        setFiles(prev => [...prev, newFile]);
      }
    } catch (err) {
      console.error('Error taking photo', err);
      onError('No se pudo tomar la foto.');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearFiles = () => setFiles([]);

  return { files, pickDocument, pickImages, takePhoto, removeFile, clearFiles };
}
