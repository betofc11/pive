import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { History, Edit3, Save } from 'lucide-react-native';
import { Theme } from '../../theme';
import { sectionStyles } from './sectionStyles';

// Placeholder content: these two entries are fixed, not read from the user's data
export function ActivityHistory() {
  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <History size={20} color={Theme.colors.secondary} />
        <Text style={sectionStyles.sectionTitle}>Historial de Actividad</Text>
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
  );
}

const styles = StyleSheet.create({
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
});
