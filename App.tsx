/**
 * Suar — offline disaster beacon & finder
 *
 * @format
 */

import '@/global.css';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/src/navigation/RootNavigator';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GluestackUIProvider mode={isDarkMode ? 'dark' : 'light'}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <RootNavigator />
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}

export default App;
