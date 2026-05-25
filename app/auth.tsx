import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../src/firebase';
import { Theme } from '../src/theme';
import { LogIn, UserPlus } from 'lucide-react-native';
import { useGoogleSignIn } from '../src/hooks/useGoogleSignIn';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleSignIn();

  useEffect(() => {
    if (googleError) {
      setError(googleError);
    }
  }, [googleError]);

  const getErrorMessage = (err: any) => {
    switch (err.code) {
      case 'auth/email-already-in-use':
        return 'Este correo ya está registrado.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Credenciales inválidas. Revisa tu correo y contraseña.';
      case 'auth/weak-password':
        return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'Dirección de correo inválida.';
      default:
        return err.message || 'Ocurrió un error inesperado.';
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    await signInWithGoogle();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/icon.png')} 
          style={styles.logoImage} 
          resizeMode="contain"
        />
        <Text style={styles.logo}>Pive</Text>
        <Text style={styles.subtitle}>Tu vibra, tu fuerza, tu plan.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={Theme.colors.onSurfaceVariant}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Theme.colors.onSurfaceVariant}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity 
          onPress={handleEmailAuth}
          disabled={loading || googleLoading}
          style={styles.submitButton}
          activeOpacity={0.8}
        >
          {loading || googleLoading ? (
            <ActivityIndicator color={Theme.colors.onPrimary} />
          ) : (
            <View style={styles.buttonInner}>
              {isLogin ? (
                <LogIn size={20} color={Theme.colors.onPrimary} />
              ) : (
                <UserPlus size={20} color={Theme.colors.onPrimary} />
              )}
              <Text style={styles.submitText}>
                {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>O continúa con</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          onPress={handleGoogleLogin}
          style={styles.googleButton}
          activeOpacity={0.8}
        >
          <Image 
            source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }} 
            style={styles.googleIcon} 
          />
          <Text style={styles.googleText}>Google</Text>
        </TouchableOpacity>

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.toggleLink}>
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  logo: {
    fontFamily: Theme.fonts.headline,
    fontSize: 54,
    color: Theme.colors.primary,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 8,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    shadowColor: '#a68cff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.onSurface,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.body,
  },
  errorText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: '#f87171',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    fontFamily: Theme.fonts.headline,
    fontWeight: 'bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
  },
  googleButton: {
    backgroundColor: Theme.colors.surfaceContainerHighest,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 4,
  },
  toggleText: {
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurfaceVariant,
    fontSize: 14,
  },
  toggleLink: {
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.primary,
    fontSize: 14,
  },
});
