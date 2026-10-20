import { Pressable, StyleSheet, Text } from 'react-native';

export function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#14659b', minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#8494a4' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryText: { color: '#164d73' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
