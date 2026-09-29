import { StyleSheet, Text, View } from 'react-native';

export default function NativeAppInstructions() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Bota mobile example</Text>
      <Text>Run the Android or iOS development build to connect to a Bota device.</Text>
      <Text>This React Native example requires the native App SDK. Expo Go and this web page cannot connect over Bluetooth.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 32, gap: 16, justifyContent: 'center', maxWidth: 640 },
  title: { fontSize: 24, fontWeight: '600' },
});
