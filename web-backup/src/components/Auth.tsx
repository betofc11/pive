import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { LogIn, UserPlus } from 'lucide-react';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const getErrorMessage = (err: any) => {
    switch (err.code) {
      case 'auth/cancelled-popup-request':
        return 'Ya hay una ventana de inicio de sesión abierta.';
      case 'auth/popup-closed-by-user':
        return 'Cerraste la ventana antes de terminar el inicio de sesión.';
      case 'auth/operation-not-allowed':
        return 'Este método de inicio de sesión no está habilitado en la consola de Firebase. Por favor, actívalo.';
      case 'auth/email-already-in-use':
        return 'Este correo ya está registrado.';
      case 'auth/invalid-credential':
        return 'Credenciales inválidas. Revisa tu correo y contraseña.';
      case 'auth/weak-password':
        return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
      default:
        return err.message || 'Ocurrió un error inesperado.';
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setError('');
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <h1 className="text-primary font-headline font-black text-5xl tracking-tighter">Pive</h1>
          <p className="text-on-surface-variant mt-2">Tu vibra, tu fuerza, tu plan.</p>
        </div>

        <div className="bg-surface-container p-8 rounded-xl border border-outline-variant/20 shadow-2xl">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/30 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="tu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/30 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            
            <button 
              type="submit"
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-full hover:shadow-[0_0_20px_rgba(166,140,255,0.4)] transition-all flex items-center justify-center gap-2"
            >
              {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
              {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/20"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface-container px-2 text-on-surface-variant">O continúa con</span></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-surface-container-highest text-on-surface font-bold py-4 rounded-full border border-outline-variant/30 hover:bg-surface-variant transition-all flex items-center justify-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Google
          </button>

          <p className="text-center mt-6 text-sm">
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-bold ml-1 hover:underline"
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
