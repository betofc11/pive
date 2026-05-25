import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase';

let GoogleSignin: any = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch (err) {
  // Gracefully handle missing native module in non-dev environments (like Expo Go)
}

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (GoogleSignin && typeof GoogleSignin.configure === 'function') {
        GoogleSignin.configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
        });
      }
    } catch (err) {
      console.warn('Google Sign-In is not supported in this environment (e.g. Expo Go):', err);
    }
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    if (!GoogleSignin || typeof GoogleSignin.signIn !== 'function') {
      setError('El inicio de sesión con Google no está disponible en Expo Go. Por favor regístrate o inicia sesión con Correo y Contraseña, o genera una build nativa.');
      return;
    }
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      setError('Por favor configura EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en tu archivo .env.');
      return;
    }
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('No se obtuvo el token de identidad de Google.');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'DEVELOPER_ERROR') {
        setError('Error de configuración (Developer Error). Verifica que tu Web Client ID y el SHA-1 estén configurados en Firebase.');
      } else {
        setError(err.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    signInWithGoogle,
    loading,
    error,
    setError,
  };
}
