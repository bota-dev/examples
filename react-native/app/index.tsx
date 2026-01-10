/**
 * Index Page - Redirects based on auth state
 */

import {Redirect} from 'expo-router';
import {useAuth} from '../src/context/AuthContext';
import {ActivityIndicator, View, StyleSheet} from 'react-native';

export default function Index() {
  const {isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});
