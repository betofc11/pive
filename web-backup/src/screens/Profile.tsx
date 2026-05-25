import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogOut, User, Mail, Edit3, Save, History } from 'lucide-react';
import { formatNum } from '../lib/utils';

export const Profile: React.FC = () => {
  const { profile, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync state with profile when editing starts or profile changes
  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBio(profile.bio || '');
      setWeight(profile.bodyMetrics?.weight?.toString() || '');
      setBodyFat(profile.bodyMetrics?.bodyFat?.toString() || '');
      setMuscleMass(profile.bodyMetrics?.muscleMass?.toString() || '');
    }
  }, [profile, isEditing]);

  const handleLogout = () => signOut(auth);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const metrics = {
        weight: parseFloat(weight) || 0,
        bodyFat: parseFloat(bodyFat) || 0,
        muscleMass: parseFloat(muscleMass) || 0,
        updatedAt: Date.now()
      };

      // Update current state in profile
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        bio,
        bodyMetrics: metrics
      });

      // Save to history collection
      await addDoc(collection(db, `users/${user.uid}/bodyMetricsHistory`), {
        userId: user.uid,
        ...metrics,
        date: new Date().toISOString(),
        createdAt: Date.now()
      });

      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 shadow-2xl">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-4xl font-bold">
                {profile?.displayName?.[0]}
              </div>
            )}
          </div>
          <button className="absolute bottom-0 right-0 bg-primary text-on-primary p-2 rounded-full shadow-lg">
            <Edit3 size={16} />
          </button>
        </div>
        <div>
          <h1 className="font-headline text-3xl font-black">{profile?.displayName}</h1>
          <p className="text-on-surface-variant">{profile?.email}</p>
        </div>
      </section>

      <section className="bg-surface-container p-6 rounded-xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="font-headline font-bold text-xl flex items-center gap-2">
            <User size={20} className="text-primary" />
            Información Personal
          </h3>
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className="text-primary font-bold text-sm flex items-center gap-1"
            disabled={loading}
          >
            {isEditing ? <Save size={16} /> : <Edit3 size={16} />}
            {isEditing ? 'Guardar' : 'Editar'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-on-surface-variant uppercase font-bold mb-1">Nombre</label>
            {isEditing ? (
              <input 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <p className="font-medium">{profile?.displayName}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant uppercase font-bold mb-1">Bio</label>
            {isEditing ? (
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary h-24"
              />
            ) : (
              <p className="text-on-surface-variant text-sm">{profile?.bio || 'Sin biografía'}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-on-surface-variant uppercase font-bold mb-1">Peso (kg)</label>
              {isEditing ? (
                <input 
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <p className="font-medium">{formatNum(profile?.bodyMetrics?.weight)} kg</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant uppercase font-bold mb-1">% Grasa</label>
              {isEditing ? (
                <input 
                  type="number"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <p className="font-medium">{formatNum(profile?.bodyMetrics?.bodyFat)}%</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant uppercase font-bold mb-1">Músculo (kg)</label>
              {isEditing ? (
                <input 
                  type="number"
                  value={muscleMass}
                  onChange={(e) => setMuscleMass(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <p className="font-medium">{formatNum(profile?.bodyMetrics?.muscleMass)} kg</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container p-6 rounded-xl space-y-4">
        <h3 className="font-headline font-bold text-xl flex items-center gap-2">
          <History size={20} className="text-secondary" />
          Historial de Actividad
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Edit3 size={18} />
              </div>
              <div>
                <p className="font-bold text-sm">Perfil Actualizado</p>
                <p className="text-[10px] text-on-surface-variant">Hoy, 10:30 AM</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <Save size={18} />
              </div>
              <div>
                <p className="font-bold text-sm">Plan Nutricional Subido</p>
                <p className="text-[10px] text-on-surface-variant">Ayer, 18:45 PM</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <button 
        onClick={handleLogout}
        className="w-full bg-surface-container-highest text-red-400 font-bold py-4 rounded-full flex items-center justify-center gap-2 hover:bg-red-400/10 transition-all"
      >
        <LogOut size={20} />
        Cerrar Sesión
      </button>
    </div>
  );
};
