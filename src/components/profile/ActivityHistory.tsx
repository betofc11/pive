import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { History, Scale, Trophy, Flame, ClipboardList, Dumbbell, LucideIcon } from 'lucide-react-native';
import { Theme } from '../../theme';
import { ActivityItem, ActivityType, formatActivityTime } from '../../lib/activity';
import { sectionStyles } from './sectionStyles';

const ICONS: Record<ActivityType, { Icon: LucideIcon; color: string }> = {
  metrics: { Icon: Scale, color: Theme.colors.primary },
  record: { Icon: Trophy, color: '#e9c46a' },
  workout: { Icon: Flame, color: '#f4a261' },
  nutritionPlan: { Icon: ClipboardList, color: Theme.colors.secondary },
  workoutPlan: { Icon: Dumbbell, color: Theme.colors.tertiary },
};

/** Recent activity: body metrics updates, strength records, finished workouts and plan uploads. */
export function ActivityHistory({ items }: { items: ActivityItem[] }) {
  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <History size={20} color={Theme.colors.secondary} />
          <Text style={sectionStyles.sectionTitle}>Historial de Actividad</Text>
        </View>
      </View>

      <View style={styles.activityList}>
        {items.map((item) => {
          const { Icon, color } = ICONS[item.type];
          return (
            <View key={item.id} style={styles.activityItem}>
              <View style={[styles.activityIconWrapper, { backgroundColor: color + '1a' }]}>
                <Icon size={16} color={color} />
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityTime}>
                  {formatActivityTime(item.timestamp)}{item.detail ? ` · ${item.detail}` : ''}
                </Text>
              </View>
            </View>
          );
        })}

        {items.length === 0 && (
          <Text style={styles.emptyText}>
            Todavía no hay actividad. Aquí verás tus cambios de composición, récords, entrenamientos y planes subidos.
          </Text>
        )}
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
    flex: 1,
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
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
});
