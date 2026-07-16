import { View, Text, ActivityIndicator } from 'react-native';
import type { BleLifecycleStatus } from '@/src/hooks/useBleLifecycle';

interface PermissionsScreenProps {
  status: BleLifecycleStatus;
  errorMessage: string | null;
}

const STATUS_COPY: Record<BleLifecycleStatus, { title: string; body: string }> = {
  idle: { title: 'Starting Suar', body: 'Getting ready…' },
  'requesting-permissions': {
    title: 'Bluetooth & location access',
    body: 'Suar needs Bluetooth and location permission to broadcast and find nearby beacons — no internet is used.',
  },
  starting: { title: 'Turning on Bluetooth', body: 'Powering up your beacon…' },
  running: { title: 'Starting Suar', body: 'Getting ready…' },
  'permission-denied': {
    title: 'Permission needed',
    body: "Suar can't broadcast or find nearby people without Bluetooth and location access. Grant them in system settings and reopen the app.",
  },
  error: { title: 'Something went wrong', body: 'Suar hit an error starting up.' },
};

export function PermissionsScreen({ status, errorMessage }: PermissionsScreenProps) {
  const copy = STATUS_COPY[status];
  const isLoading = status === 'idle' || status === 'requesting-permissions' || status === 'starting';

  return (
    <View className="flex-1 items-center justify-center bg-background-0 px-8">
      {isLoading ? (
        <View className="mb-6">
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      <Text
        className="mb-2 text-center text-xl font-bold text-typography-900"
        accessibilityRole="header">
        {copy.title}
      </Text>
      <Text className="text-center text-base text-typography-600" accessibilityLiveRegion="polite">
        {copy.body}
      </Text>
      {errorMessage ? (
        <Text className="mt-4 text-center text-sm text-error-600">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
