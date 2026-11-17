import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Brain, Pencil, Trash2 } from 'lucide-react-native';
import { Alert } from '../../lib/alert';
import { Theme } from '../../theme';
import { sectionStyles } from './sectionStyles';
import { useCoachMemory } from '../../hooks/useCoachMemory';
import { deleteAllFacts, deleteFact, setMemoryEnabled, updateFactText } from '../../services/memoryService';
import {
  MAX_FACT_TEXT,
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type MemoryFact,
} from '../../../functions/src/shared/memory/memory';

/** Group titles: a category can hold several facts */
const GROUP_LABELS: Record<MemoryCategory, string> = {
  allergy: 'Alergias e intolerancias',
  restriction: 'Restricciones',
  food: 'Alimentos',
  injury: 'Lesiones',
  schedule: 'Horarios',
  equipment: 'Equipo',
  goal: 'Objetivos',
  context: 'Contexto',
};

const SOURCE_LABELS: Record<MemoryFact['source'], string> = {
  chat: 'Del chat',
  plan: 'De tu plan',
  app: 'Editado por ti',
};

const showError = (action: string, err: unknown) => {
  console.error(`[Memory] Could not ${action}:`, err);
  Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
};

function FactRow({ uid, fact }: { uid: string; fact: MemoryFact }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEditing = draft !== null;

  const save = async () => {
    if (draft === null) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await updateFactText(uid, fact.key, text);
      setDraft(null);
    } catch (err) {
      showError('edit a fact', err);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('¿Borrar este dato?', `Pive olvidará: "${fact.text}"`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          deleteFact(uid, fact.key).catch((err) => showError('delete a fact', err));
        },
      },
    ]);

  if (isEditing) {
    return (
      <View style={styles.editBox}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={styles.input}
          multiline
          maxLength={MAX_FACT_TEXT}
          autoFocus
          accessibilityLabel="Texto del dato"
        />
        <View style={styles.editActions}>
          <TouchableOpacity onPress={() => setDraft(null)} style={styles.textButton} accessibilityRole="button" disabled={busy}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={save}
            style={styles.textButton}
            accessibilityRole="button"
            disabled={busy || !draft.trim()}
          >
            {busy ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Text style={styles.linkText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.factRow}>
      <View style={styles.factInfo}>
        <Text style={styles.factText}>{fact.text}</Text>
        <Text style={styles.factSource}>{SOURCE_LABELS[fact.source]}</Text>
      </View>
      <TouchableOpacity
        onPress={() => setDraft(fact.text)}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={`Editar: ${fact.text}`}
      >
        <Pencil size={16} color={Theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
      <TouchableOpacity onPress={remove} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Borrar: ${fact.text}`}>
        <Trash2 size={16} color={Theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}

/** "Lo que Pive sabe de ti": the memory's facts by category, to edit or delete, and the switch to turn it off. */
export function MemorySection({ uid }: { uid?: string }) {
  const { memory, loading } = useCoachMemory(uid);
  const [toggling, setToggling] = useState(false);

  const facts = memory ? Object.values(memory.facts) : [];
  const enabled = memory?.enabled ?? true;
  const groups = MEMORY_CATEGORIES.map((category) => ({
    category,
    facts: facts.filter((f) => f.category === category).sort((a, b) => b.updatedAt - a.updatedAt),
  })).filter((g) => g.facts.length > 0);

  const toggle = async (value: boolean) => {
    if (!uid) return;
    setToggling(true);
    try {
      await setMemoryEnabled(uid, value);
    } catch (err) {
      showError('change the memory switch', err);
    } finally {
      setToggling(false);
    }
  };

  const clearAll = () => {
    if (!uid) return;
    Alert.alert('¿Borrar todo lo que Pive sabe de ti?', 'Se borran todos los datos. Esto no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: () => {
          deleteAllFacts(uid).catch((err) => showError('clear the memory', err));
        },
      },
    ]);
  };

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <View style={styles.titleLeft}>
          <Brain size={20} color={Theme.colors.primary} />
          <Text style={sectionStyles.sectionTitle} accessibilityRole="header">
            Lo que Pive sabe de ti
          </Text>
        </View>
      </View>

      <View style={sectionStyles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Memoria activa</Text>
          {toggling ? (
            <ActivityIndicator size="small" color={Theme.colors.primary} />
          ) : (
            <Switch
              value={enabled}
              onValueChange={toggle}
              disabled={!uid || loading}
              trackColor={{ true: Theme.colors.primary, false: Theme.colors.outlineVariant }}
              accessibilityLabel={`Memoria activa: ${enabled ? 'activada' : 'desactivada'}`}
            />
          )}
        </View>
        <Text style={styles.helpText}>
          {enabled
            ? 'Pive recuerda lo importante que le cuentas (alergias, gustos, horarios) para darte mejores consejos. Puedes editarlo o borrarlo cuando quieras.'
            : 'La memoria está apagada: Pive no la usa ni aprende cosas nuevas. Lo que ya sabía se conserva.'}
        </Text>

        {loading && <ActivityIndicator size="small" color={Theme.colors.primary} />}

        {!loading && facts.length === 0 && (
          <Text style={styles.emptyText}>
            Todavía no sé nada de ti. Aquí verás lo que me cuentes en el chat y las restricciones de tu plan.
          </Text>
        )}

        {uid &&
          groups.map((group) => (
            <View key={group.category} style={[styles.group, !enabled ? styles.dimmed : null]}>
              <Text style={styles.groupTitle}>{GROUP_LABELS[group.category]}</Text>
              {group.facts.map((fact) => (
                <FactRow key={fact.key} uid={uid} fact={fact} />
              ))}
            </View>
          ))}

        {facts.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.textButton} accessibilityRole="button">
            <Text style={styles.dangerText}>Borrar todo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  switchLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  helpText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 17,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  group: {
    gap: 4,
  },
  dimmed: {
    opacity: 0.5,
  },
  groupTitle: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Theme.colors.primary,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  factInfo: {
    flex: 1,
    gap: 2,
    paddingVertical: 4,
  },
  factText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    lineHeight: 19,
  },
  factSource: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBox: {
    gap: 4,
    paddingVertical: 4,
  },
  input: {
    minHeight: 44,
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  textButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  cancelText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  dangerText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.error,
  },
});
