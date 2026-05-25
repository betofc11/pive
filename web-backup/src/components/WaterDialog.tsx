import React, { useState } from 'react';
import { Modal } from './Modal';
import { Droplets, Plus, Minus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { formatNum, getLocalDateString } from '../lib/utils';

export const WaterDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(250); // Default glass size
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = getLocalDateString();
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, today);
      
      const logDoc = await getDoc(logRef);
      
      if (logDoc.exists()) {
        const currentData = logDoc.data();
        await updateDoc(logRef, {
          waterIntake: (currentData.waterIntake || 0) + amount
        });
      } else {
        await setDoc(logRef, {
          id: today,
          userId: user.uid,
          date: new Date().toISOString(),
          macros: { protein: 0, carbs: 0, fats: 0, calories: 0 },
          meals: [],
          waterIntake: amount
        });
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/dailyLogs`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Agua">
      <div className="space-y-8 py-4">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
            <Droplets size={48} className="fill-secondary/20" />
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setAmount(Math.max(50, amount - 50))}
              className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <Minus size={24} />
            </button>
            
            <div className="text-center w-32">
              <span className="font-headline font-black text-5xl">{formatNum(amount)}</span>
              <span className="text-on-surface-variant font-bold ml-1">ml</span>
            </div>

            <button 
              onClick={() => setAmount(amount + 50)}
              className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="flex gap-2">
            {[250, 500, 1000].map(preset => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  amount === preset 
                    ? 'bg-secondary text-on-secondary' 
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {formatNum(preset)}ml
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-secondary text-on-secondary py-4 rounded-xl font-bold disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Añadir Agua'}
        </button>
      </div>
    </Modal>
  );
};
