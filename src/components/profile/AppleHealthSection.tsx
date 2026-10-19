import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Heart, Download, RefreshCw } from 'lucide-react-native';
import { Alert } from '../../lib/alert';
import { Theme } from '../../theme';
import { BodyMetrics } from '../../types';
import { initHealthKit } from '../../services/healthKitService';
import { HealthImportModal } from './HealthImportModal';
import { sectionStyles } from './sectionStyles';

interface AppleHealthSectionProps {
  uid?: string;
  currentMetrics?: BodyMetrics;
}

/** Apple Health connection status, (re)connect and import of the latest measurements. iOS only. */
export function AppleHealthSection({ uid, currentMetrics }: AppleHealthSectionProps) {
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Check HealthKit connection on mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      initHealthKit().then((connected) => {
        setIsHealthConnected(connected);
      }).catch(err => {
        console.warn('[HealthKit] Mount connection check failed:', err);
      });
    }
  }, []);

  const handleConnectHealthKit = async () => {
    try {
      const success = await initHealthKit();
      setIsHealthConnected(success);
      if (success) {
        Alert.alert(
          'Conexión Exitosa',
          'Pive ahora está conectado con Apple Health. Tus nuevas comidas y mediciones de composición corporal se guardarán automáticamente.'
        );
      } else {
        Alert.alert(
          'Permisos Requeridos',
          'No se pudo activar la sincronización. Asegúrate de dar los permisos correspondientes en Ajustes → Salud → Acceso a datos y dispositivos → Pive.'
        );
      }
    } catch (error: any) {
      console.warn('[HealthKit] Error during manual initialization:', error);
      Alert.alert(
        'Apple Health no disponible',
        error.message || 'No se pudo conectar con Apple Health en este dispositivo.'
      );
    }
  };

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Heart size={20} color="#ff3b30" />
          <Text style={sectionStyles.sectionTitle}>Apple Health</Text>
        </View>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: isHealthConnected ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)' }
        ]}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: isHealthConnected ? '#34c759' : '#8e8e93' }
          ]} />
          <Text style={[
            styles.statusText, 
            { color: isHealthConnected ? '#34c759' : '#8e8e93' }
          ]}>
            {isHealthConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>

      <View style={sectionStyles.card}>
        <Text style={styles.healthDescription}>
          Sincroniza automáticamente tus comidas y composición corporal con la app Salud de Apple.
        </Text>
        
        {isHealthConnected ? (
          <View style={styles.healthButtonsRow}>
            <TouchableOpacity 
              style={[styles.healthButton, { flex: 1.2, marginTop: 0 }]}
              onPress={() => setIsImportModalOpen(true)}
              activeOpacity={0.8}
            >
              <Download size={16} color="#ffffff" />
              <Text style={styles.healthButtonText}>Importar Datos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.healthButtonSecondary, { flex: 1 }]}
              onPress={handleConnectHealthKit}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color={Theme.colors.onSurface} />
              <Text style={styles.healthButtonSecondaryText}>Vincular</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.healthButton}
            onPress={handleConnectHealthKit}
            activeOpacity={0.8}
          >
            <Heart size={18} color="#ffffff" fill="#ffffff" />
            <Text style={styles.healthButtonText}>Conectar con Apple Health</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.healthNote}>
          Nota: Si ya diste permisos antes o deseas modificarlos, debes hacerlo desde la app de Ajustes de tu iPhone → Salud → Acceso a datos y dispositivos → Pive.
        </Text>
      </View>

      <HealthImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        uid={uid}
        currentMetrics={currentMetrics}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
  },
  healthDescription: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 8,
  },
  healthButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  healthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff3b30',
    paddingVertical: 12,
    borderRadius: 99,
    marginTop: 8,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  healthButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: '#ffffff',
  },
  healthButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 12,
    borderRadius: 99,
  },
  healthButtonSecondaryText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  healthNote: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 8,
  },
});
