import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useBleLifecycle } from '@/src/hooks/useBleLifecycle';
import { PermissionsScreen } from '@/src/screens/PermissionsScreen';
import { RadarScreen } from '@/src/screens/RadarScreen';

export type RootStackParamList = {
  Radar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Owns the BLE lifecycle at the root so permissions/adapter/scan/broadcast are
 * only ever started once. Everything after the permissions gate lives on a
 * single adaptive "Radar" screen — see plan §"Screens: one adaptive screen,
 * not three" — rather than separate routes per accessibility mode.
 */
export function RootNavigator() {
  const { status, errorMessage } = useBleLifecycle();

  if (status !== 'running') {
    return <PermissionsScreen status={status} errorMessage={errorMessage} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Radar" component={RadarScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
