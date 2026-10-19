import { StyleSheet } from 'react-native';
import { Theme } from '../../theme';

// Section title row and card, shared by the profile sections
export const sectionStyles = StyleSheet.create({
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
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
});
