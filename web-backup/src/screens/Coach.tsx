import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Construction } from 'lucide-react';

export const Coach: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative"
      >
        <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <Sparkles size={64} className="animate-pulse" />
        </div>
        <div className="absolute -bottom-2 -right-2 bg-secondary text-on-secondary p-2 rounded-lg shadow-lg rotate-12">
          <Construction size={20} />
        </div>
      </motion.div>

      <div className="space-y-4 max-w-sm">
        <h1 className="font-headline text-4xl font-black tracking-tighter">
          Escáner de <span className="text-primary">Rutinas</span>
        </h1>
        <p className="text-on-surface-variant text-lg">
          Pronto podrás subir cualquier rutina de gimnasio (foto, PDF o documento) y Pive la organizará por ti con imágenes y seguimiento inteligente.
        </p>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 border border-primary/5 w-full max-w-xs">
        <span className="font-label text-xs uppercase tracking-widest text-primary font-bold">Próximamente</span>
        <div className="mt-4 space-y-3">
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "85%" }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
              className="h-full bg-primary"
            />
          </div>
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Configurando escáner inteligente...</p>
        </div>
      </div>
    </div>
  );
};
