import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, Scale } from 'lucide-react';
import { Modal } from './Modal';
import { analyzeBodyComposition } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';

import mammoth from 'mammoth';

export const BodyCompositionDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'edit' | 'saving'>('upload');
  
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/*': [], 
      'application/pdf': [],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    multiple: false,
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined
  } as any);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      let analysisInput: { base64Data?: string; mimeType?: string; text?: string } = {};

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        analysisInput.text = result.value;
      } else if (file.type === 'text/plain') {
        analysisInput.text = await file.text();
      } else if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        analysisInput.base64Data = await base64Promise;
        analysisInput.mimeType = file.type;
      } else {
        // Fallback to text for excel/other doc types
        analysisInput.text = await file.text();
      }

      const result = await analyzeBodyComposition(analysisInput);
      
      setWeight(result.weight?.toString() || profile?.bodyMetrics?.weight?.toString() || '');
      setBodyFat(result.bodyFat?.toString() || profile?.bodyMetrics?.bodyFat?.toString() || '');
      setMuscleMass(result.muscleMass?.toString() || profile?.bodyMetrics?.muscleMass?.toString() || '');
      
      setStep('edit');
    } catch (error) {
      console.error("Error analyzing composition:", error);
      alert("Error al analizar el documento. Intenta de nuevo o ingresa los datos manualmente.");
      setStep('edit'); // Allow manual entry even if analysis fails
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setStep('saving');
    try {
      const metrics = {
        weight: parseFloat(weight) || 0,
        bodyFat: parseFloat(bodyFat) || 0,
        muscleMass: parseFloat(muscleMass) || 0,
        updatedAt: Date.now()
      };

      // Update current state in profile
      await updateDoc(doc(db, 'users', user.uid), {
        bodyMetrics: metrics
      });

      // Save to history collection
      await addDoc(collection(db, `users/${user.uid}/bodyMetricsHistory`), {
        userId: user.uid,
        ...metrics,
        date: new Date().toISOString(),
        createdAt: Date.now()
      });

      onClose();
      // Reset state
      setFile(null);
      setPreview(null);
      setStep('upload');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setStep('edit');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Composición Corporal">
      {step === 'upload' && (
        <div className="space-y-6">
          <p className="text-sm text-on-surface-variant text-center">
            Sube tu reporte InBody, documento de tu nutricionista o ingresa los datos manualmente.
          </p>
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <FileText size={32} />
                </div>
                <p className="font-medium text-primary">{file.name}</p>
                <p className="text-xs text-on-surface-variant">Toca para cambiar el archivo</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto text-primary">
                  <Upload size={32} />
                </div>
                <div>
                  <p className="font-medium">Sube un archivo o foto</p>
                  <p className="text-sm text-on-surface-variant mt-1">Formatos: PDF, Word, Excel, Texto, Fotos</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('edit')}
              className="flex-1 bg-surface-container-high text-on-surface py-4 rounded-xl font-bold hover:bg-surface-container-highest transition-colors"
            >
              Entrada Manual
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className="flex-1 bg-primary text-on-primary py-4 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Analizar'}
            </button>
          </div>
        </div>
      )}

      {step === 'edit' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <button 
              onClick={() => setStep('upload')} 
              className="text-primary flex items-center gap-1 text-sm font-bold hover:text-primary/80 transition-colors"
            >
              ← Volver al escáner
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Peso (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-xl font-bold"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">% Grasa Corporal</label>
              <input
                type="number"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-xl font-bold"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Masa Muscular (kg)</label>
              <input
                type="number"
                value={muscleMass}
                onChange={(e) => setMuscleMass(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-xl font-bold"
                placeholder="0.0"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            Guardar Métricas
          </button>
        </div>
      )}

      {step === 'saving' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-lg font-medium">Guardando historial...</p>
        </div>
      )}
    </Modal>
  );
};
