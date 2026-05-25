import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, ClipboardList, BarChart3, Dumbbell, Settings, Plus, Droplets, Utensils, Scale } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { FoodDialog } from './FoodDialog';
import { WaterDialog } from './WaterDialog';
import { BodyCompositionDialog } from './BodyCompositionDialog';
import { RecordDialog } from './RecordDialog';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const [isFabOpen, setIsFabOpen] = useState(false);
  
  const [activeDialog, setActiveDialog] = useState<'food' | 'water' | 'body' | 'record' | null>(null);

  const navItems = [
    { name: 'Pive', path: '/', icon: Sparkles },
    { name: 'Plan', path: '/plan', icon: ClipboardList },
    { name: 'Stats', path: '/stats', icon: BarChart3 },
    { name: 'Coach', path: '/coach', icon: Dumbbell },
  ];

  const fabOptions = [
    { name: 'Comida', id: 'food', icon: Utensils, color: 'bg-tertiary', textColor: 'text-on-tertiary' },
    { name: 'Agua', id: 'water', icon: Droplets, color: 'bg-secondary', textColor: 'text-on-secondary' },
    { name: 'Composición', id: 'body', icon: Scale, color: 'bg-primary', textColor: 'text-on-primary' },
    { name: 'Récord', id: 'record', icon: Dumbbell, color: 'bg-surface-container-highest', textColor: 'text-on-surface' },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-on-background font-body relative">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-outline-variant/20 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <linearGradient id="headerLogoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00E5FF"/>
                  <stop offset="100%" stopColor="#7C4DFF"/>
                </linearGradient>
              </defs>
              <path 
                d="M15 75C20 60 35 50 50 50C65 50 75 60 80 75M50 50C50 50 55 25 75 20M50 50L40 35" 
                stroke="url(#headerLogoGradient)" 
                strokeWidth="7" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <circle cx="82" cy="28" r="6" fill="url(#headerLogoGradient)" />
              <path d="M40 60C48 55 58 55 65 60" stroke="url(#headerLogoGradient)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
          <span className="text-primary font-headline font-extrabold text-2xl tracking-tight">Pive</span>
        </div>
        <Link to="/profile" className="relative group">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 bg-surface-container group-hover:border-primary transition-all shadow-lg">
            {profile?.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt="Profile" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                {profile?.displayName?.[0] || 'U'}
              </div>
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-32 px-6 max-w-2xl mx-auto">
        {children}
      </main>

      {/* Dialogs */}
      <FoodDialog isOpen={activeDialog === 'food'} onClose={() => setActiveDialog(null)} />
      <WaterDialog isOpen={activeDialog === 'water'} onClose={() => setActiveDialog(null)} />
      <BodyCompositionDialog isOpen={activeDialog === 'body'} onClose={() => setActiveDialog(null)} />
      <RecordDialog isOpen={activeDialog === 'record'} onClose={() => setActiveDialog(null)} />

      {/* FAB Menu Overlay */}
      <AnimatePresence>
        {isFabOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-end justify-end pr-6 pb-48"
            onClick={() => setIsFabOpen(false)}
          >
            <div className="flex flex-col items-end gap-4" onClick={e => e.stopPropagation()}>
              {fabOptions.map((option, index) => (
                <motion.button
                  key={option.name}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 group"
                  onClick={() => {
                    setIsFabOpen(false);
                    setActiveDialog(option.id);
                  }}
                >
                  <span className="font-bold text-sm bg-surface-container-high px-4 py-2 rounded-xl shadow-lg border border-outline-variant/20">{option.name}</span>
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110", option.color, option.textColor)}>
                    <option.icon size={24} />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <div className="fixed bottom-28 right-6 z-50">
        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(166,140,255,0.3)] transition-all duration-300",
            isFabOpen ? "bg-surface-container-highest text-on-surface rotate-45" : "bg-primary text-on-primary hover:scale-105"
          )}
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl border-t border-outline-variant/20 rounded-t-[3rem] px-4 pb-8 pt-3 flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center transition-all duration-300",
                isActive ? "bg-primary text-on-primary rounded-full px-6 py-2 scale-105" : "text-on-surface-variant hover:text-secondary px-4 py-2"
              )}
            >
              <item.icon size={24} />
              <span className="font-medium text-[11px] uppercase tracking-wider mt-1">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
