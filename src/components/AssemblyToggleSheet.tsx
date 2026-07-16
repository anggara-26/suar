import { Modal, Pressable, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '@/src/state/settingsStore';

interface AssemblyToggleSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AssemblyToggleSheet({ visible, onClose }: AssemblyToggleSheetProps) {
  const isAssemblyPoint = useSettingsStore((state) => state.isAssemblyPoint);
  const setIsAssemblyPoint = useSettingsStore((state) => state.setIsAssemblyPoint);
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const disasterMode = useSettingsStore((state) => state.disasterMode);
  const setDisasterMode = useSettingsStore((state) => state.setDisasterMode);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end bg-black/40"
        onPress={onClose}
        accessibilityLabel="Close settings"
        accessibilityRole="button">
        <Pressable
          className="rounded-t-3xl bg-background-0 px-5 pb-8 pt-4"
          // Swallow taps inside the sheet so they don't fall through to the backdrop.
          onPress={(event) => event.stopPropagation()}>
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-200" />

          <View className="mb-6 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-base font-semibold text-typography-900">
                Assembly point
              </Text>
              <Text className="text-sm text-typography-600">
                Broadcast this phone as a fixed "come here, safe" beacon
              </Text>
            </View>
            <Switch
              value={isAssemblyPoint}
              onValueChange={setIsAssemblyPoint}
              accessibilityLabel="Toggle assembly point"
            />
          </View>

          <Text className="mb-2 text-base font-semibold text-typography-900">Accessibility</Text>
          <Text className="mb-3 text-sm text-typography-600">
            Voice, vibration, and the radar are all on by default — switch off the channels you
            don't want. The radar is always on.
          </Text>

          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-base font-medium text-typography-900">Voice guidance</Text>
              <Text className="text-sm text-typography-600">
                Spoken distance and status announcements
              </Text>
            </View>
            <Switch
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              accessibilityLabel="Toggle voice guidance"
            />
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-base font-medium text-typography-900">Vibration feedback</Text>
              <Text className="text-sm text-typography-600">
                Distance patterns for the nearest or focused beacon
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              accessibilityLabel="Toggle vibration feedback"
            />
          </View>

          <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-base font-semibold text-typography-900">Disaster mode</Text>
              <Text className="text-sm text-typography-600">
                Reduce screen and radio use to extend battery life
              </Text>
            </View>
            <Switch
              value={disasterMode}
              onValueChange={setDisasterMode}
              accessibilityLabel="Toggle disaster mode"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
