import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform, Pressable } from 'react-native';
import { Alert } from '../src/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/hooks/useAuth';
import { auth, db, handleFirestoreError, OperationType } from '../src/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { Theme } from '../src/theme';
import { formatNum } from '../src/lib/utils';
import { ArrowLeft, LogOut, User, Edit3, Save, History, Heart, Check, Download, RefreshCw } from 'lucide-react-native';
import { router } from 'expo-router';
import { saveMetricsToHealthKit, initHealthKit, getLatestMetricsFromHealthKit, HealthKitLatestMetrics } from '../src/services/healthKitService';
import { Modal } from '../src/components/Modal';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [loading, setLoading] = useState(false);

  // HealthKit specific states
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [healthData, setHealthData] = useState<HealthKitLatestMetrics | null>(null);
  const [fetchingHealthData, setFetchingHealthData] = useState(false);
  const [importWeight, setImportWeight] = useState(true);
  const [importBodyFat, setImportBodyFat] = useState(true);
  const [importMuscleMass, setImportMuscleMass] = useState(true);
  const [savingImport, setSavingImport] = useState(false);

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

  // Fetch HealthKit data when import modal is opened
  useEffect(() => {
    if (isImportModalOpen) {
      fetchHealthData();
    }
  }, [isImportModalOpen]);

  // Sync state with profile when editing starts or profile changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBio(profile.bio || '');
      setWeight(profile.bodyMetrics?.weight?.toString() || '');
      setBodyFat(profile.bodyMetrics?.bodyFat?.toString() || '');
      setMuscleMass(profile.bodyMetrics?.muscleMass?.toString() || '');
    }
  }, [profile, isEditing]);


  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: () => signOut(auth)
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const parsedWeight = parseFloat(weight) || 0;
      const parsedBodyFat = parseFloat(bodyFat) || 0;
      const parsedMuscleMass = parseFloat(muscleMass) || 0;

      const metrics = {
        weight: parsedWeight,
        bodyFat: parsedBodyFat,
        muscleMass: parsedMuscleMass,
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

      // Sync to HealthKit
      saveMetricsToHealthKit(metrics.weight, metrics.bodyFat, metrics.muscleMass).catch(err => {
        console.warn('[HealthKit] Error syncing metrics from profile.tsx:', err);
      });

      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchHealthData = async () => {
    setFetchingHealthData(true);
    setHealthData(null);
    try {
      const data = await getLatestMetricsFromHealthKit();
      setHealthData(data);
      setImportWeight(!!data.weight);
      setImportBodyFat(!!data.bodyFat);
      setImportMuscleMass(!!data.muscleMass);
    } catch (err) {
      console.warn('[HealthKit] Error fetching data for modal:', err);
      Alert.alert(
        'Error de Lectura',
        'No pudimos consultar tus datos de Apple Health. Por favor, asegúrate de activar los permisos de lectura en la app Ajustes.'
      );
      setIsImportModalOpen(false);
    } finally {
      setFetchingHealthData(false);
    }
  };

  const handleSaveImport = async () => {
    if (!user || !healthData) return;
    setSavingImport(true);
    try {
      const currentMetrics = profile?.bodyMetrics;
      
      const updatedWeight = importWeight && healthData.weight 
        ? healthData.weight.value 
        : (currentMetrics?.weight || 0);

      const updatedBodyFat = importBodyFat && healthData.bodyFat 
        ? healthData.bodyFat.value 
        : (currentMetrics?.bodyFat || 0);

      const updatedMuscleMass = importMuscleMass && healthData.muscleMass 
        ? healthData.muscleMass.value 
        : (currentMetrics?.muscleMass || 0);

      const metrics = {
        weight: updatedWeight,
        bodyFat: updatedBodyFat,
        muscleMass: updatedMuscleMass,
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

      // Sync back to HealthKit just to confirm
      saveMetricsToHealthKit(metrics.weight, metrics.bodyFat, metrics.muscleMass).catch(err => {
        console.warn('[HealthKit] Error syncing metrics after import:', err);
      });

      Alert.alert(
        'Importación Exitosa',
        'Se han importado y guardado tus métricas seleccionadas en tu perfil.'
      );
      setIsImportModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSavingImport(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header Navigation */}
      <View style={styles.navHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={24} color={Theme.colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Mi Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarContainer}>
            {profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {profile?.displayName?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{profile?.displayName || 'Usuario'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <User size={20} color={Theme.colors.primary} />
              <Text style={styles.sectionTitle}>Información Personal</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              ) : (
                <>
                  <Text style={styles.editButtonText}>{isEditing ? 'Guardar' : 'Editar'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nombre</Text>
              {isEditing ? (
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={styles.input}
                  placeholder="Tu nombre..."
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                />
              ) : (
                <Text style={styles.fieldValue}>{profile?.displayName || 'Sin nombre'}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bio</Text>
              {isEditing ? (
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, styles.textArea]}
                  placeholder="Escribe algo sobre ti..."
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                />
              ) : (
                <Text style={styles.bioText}>{profile?.bio || 'Sin biografía'}</Text>
              )}
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.fieldLabel}>Peso (kg)</Text>
                {isEditing ? (
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    style={styles.metricInput}
                    placeholder="0"
                    placeholderTextColor={Theme.colors.onSurfaceVariant}
                  />
                ) : (
                  <Text style={styles.metricValue}>{formatNum(profile?.bodyMetrics?.weight)} kg</Text>
                )}
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.fieldLabel}>% Grasa</Text>
                {isEditing ? (
                  <TextInput
                    value={bodyFat}
                    onChangeText={setBodyFat}
                    keyboardType="numeric"
                    style={styles.metricInput}
                    placeholder="0"
                    placeholderTextColor={Theme.colors.onSurfaceVariant}
                  />
                ) : (
                  <Text style={styles.metricValue}>{formatNum(profile?.bodyMetrics?.bodyFat)}%</Text>
                )}
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.fieldLabel}>Músculo (kg)</Text>
                {isEditing ? (
                  <TextInput
                    value={muscleMass}
                    onChangeText={setMuscleMass}
                    keyboardType="numeric"
                    style={styles.metricInput}
                    placeholder="0"
                    placeholderTextColor={Theme.colors.onSurfaceVariant}
                  />
                ) : (
                  <Text style={styles.metricValue}>{formatNum(profile?.bodyMetrics?.muscleMass)} kg</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Apple Health Integration */}
        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Heart size={20} color="#ff3b30" />
                <Text style={styles.sectionTitle}>Apple Health</Text>
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

            <View style={styles.card}>
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
          </View>
        )}

        {/* Activity History */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <History size={20} color={Theme.colors.secondary} />
            <Text style={styles.sectionTitle}>Historial de Actividad</Text>
          </View>

          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={[styles.activityIconWrapper, { backgroundColor: Theme.colors.primary + '1a' }]}>
                <Edit3 size={16} color={Theme.colors.primary} />
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>Perfil Actualizado</Text>
                <Text style={styles.activityTime}>Hoy, 10:30 AM</Text>
              </View>
            </View>

            <View style={styles.activityItem}>
              <View style={[styles.activityIconWrapper, { backgroundColor: Theme.colors.secondary + '1a' }]}>
                <Save size={16} color={Theme.colors.secondary} />
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>Plan Nutricional Subido</Text>
                <Text style={styles.activityTime}>Ayer, 6:45 PM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={20} color={Theme.colors.error} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        {/* Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de Importación de HealthKit */}
      <Modal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        title="Importar de Apple Health"
      >
        <View style={styles.modalContainer}>
          <Text style={styles.subtext}>
            Trae tus mediciones más recientes registradas por básculas inteligentes u otras apps vinculadas a Apple Health.
          </Text>

          {fetchingHealthData ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={Theme.colors.primary} />
              <Text style={styles.modalLoadingText}>Consultando a Apple Health...</Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {healthData && (healthData.weight || healthData.bodyFat || healthData.muscleMass) ? (
                <View style={styles.importList}>
                  {healthData.weight && (
                    <Pressable 
                      style={[styles.importRow, importWeight && styles.importRowSelected]}
                      onPress={() => setImportWeight(!importWeight)}
                    >
                      <View style={styles.importRowLeft}>
                        <View style={[styles.checkbox, importWeight && styles.checkboxChecked]}>
                          {importWeight && <Check size={12} color="#ffffff" strokeWidth={3} />}
                        </View>
                        <View style={{ gap: 2, flex: 1 }}>
                          <Text style={styles.importRowLabel}>Peso Corporal</Text>
                          <Text style={styles.importRowDate}>{formatDate(healthData.weight.date)}</Text>
                        </View>
                      </View>
                      <View style={styles.importRowRight}>
                        <Text style={styles.importedValueText}>
                          {formatNum(healthData.weight.value)} kg
                        </Text>
                        <Text style={styles.currentValueText}>
                          Actual: {profile?.bodyMetrics?.weight ? `${formatNum(profile.bodyMetrics.weight)} kg` : 'N/A'}
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {healthData.bodyFat && (
                    <Pressable 
                      style={[styles.importRow, importBodyFat && styles.importRowSelected]}
                      onPress={() => setImportBodyFat(!importBodyFat)}
                    >
                      <View style={styles.importRowLeft}>
                        <View style={[styles.checkbox, importBodyFat && styles.checkboxChecked]}>
                          {importBodyFat && <Check size={12} color="#ffffff" strokeWidth={3} />}
                        </View>
                        <View style={{ gap: 2, flex: 1 }}>
                          <Text style={styles.importRowLabel}>% Grasa Corporal</Text>
                          <Text style={styles.importRowDate}>{formatDate(healthData.bodyFat.date)}</Text>
                        </View>
                      </View>
                      <View style={styles.importRowRight}>
                        <Text style={styles.importedValueText}>
                          {formatNum(healthData.bodyFat.value)}%
                        </Text>
                        <Text style={styles.currentValueText}>
                          Actual: {profile?.bodyMetrics?.bodyFat ? `${formatNum(profile.bodyMetrics.bodyFat)}%` : 'N/A'}
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {healthData.muscleMass && (
                    <Pressable 
                      style={[styles.importRow, importMuscleMass && styles.importRowSelected]}
                      onPress={() => setImportMuscleMass(!importMuscleMass)}
                    >
                      <View style={styles.importRowLeft}>
                        <View style={[styles.checkbox, importMuscleMass && styles.checkboxChecked]}>
                          {importMuscleMass && <Check size={12} color="#ffffff" strokeWidth={3} />}
                        </View>
                        <View style={{ gap: 2, flex: 1 }}>
                          <Text style={styles.importRowLabel}>Masa Muscular</Text>
                          <Text style={styles.importRowDate}>{formatDate(healthData.muscleMass.date)}</Text>
                        </View>
                      </View>
                      <View style={styles.importRowRight}>
                        <Text style={styles.importedValueText}>
                          {formatNum(healthData.muscleMass.value)} kg
                        </Text>
                        <Text style={styles.currentValueText}>
                          Actual: {profile?.bodyMetrics?.muscleMass ? `${formatNum(profile.bodyMetrics.muscleMass)} kg` : 'N/A'}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={styles.noDataText}>
                  No se encontraron registros recientes en Apple Health.
                </Text>
              )}

              <View style={styles.modalFooter}>
                <Pressable 
                  style={styles.modalCancelButton}
                  onPress={() => setIsImportModalOpen(false)}
                  disabled={savingImport}
                >
                  <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                </Pressable>

                {healthData && (healthData.weight || healthData.bodyFat || healthData.muscleMass) && (
                  <Pressable 
                    style={[
                      styles.modalSaveButton, 
                      (!importWeight && !importBodyFat && !importMuscleMass) || savingImport ? styles.disabledButton : null
                    ]}
                    onPress={handleSaveImport}
                    disabled={(!importWeight && !importBodyFat && !importMuscleMass) || savingImport}
                  >
                    {savingImport ? (
                      <ActivityIndicator color={Theme.colors.onPrimary} size="small" />
                    ) : (
                      <Text style={styles.modalSaveButtonText}>Importar y Guardar</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  navTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onBackground,
  },
  scrollContent: {
    padding: 24,
    gap: 32,
  },
  profileHeaderCard: {
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Theme.colors.primary + '33',
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.primary + '33',
  },
  avatarFallbackText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 40,
    color: Theme.colors.primary,
  },
  profileName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 26,
    color: Theme.colors.onBackground,
  },
  profileEmail: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  section: {
    gap: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onBackground,
  },
  editButton: {
    backgroundColor: Theme.colors.primary + '1a',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 99,
  },
  editButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  bioText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  input: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metricItem: {
    flex: 1,
    gap: 6,
  },
  metricValue: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  metricInput: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.colors.surfaceContainer,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  activityIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    gap: 2,
  },
  activityTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  activityTime: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 16,
    borderRadius: 99,
    marginTop: 8,
  },
  logoutButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.error,
  },
  healthDescription: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 8,
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
  healthNote: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 8,
  },
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
  healthButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  modalContainer: {
    gap: 16,
    paddingBottom: 8,
  },
  subtext: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  importList: {
    gap: 12,
    marginVertical: 8,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    borderRadius: 16,
  },
  importRowSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '10',
  },
  importRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  importRowLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  importRowDate: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  importRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  importedValueText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  currentValueText: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  noDataText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

