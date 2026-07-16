import { Modal, Pressable, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '@/src/state/settingsStore';
import type { AccessibilityMode } from '@/src/types/accessibility';

interface AssemblyToggleSheetProps {
  visible: boolean;
  onClose: () => void;
}

const MODE_OPTIONS: { mode: AccessibilityMode; label: string; hint: string }[] = [
  { mode: 'standard', label: 'Standard', hint: 'Balanced voice, visual, and haptic' },
  { mode: 'blind', label: 'Blind / low-vision', hint: 'Voice and haptic lead' },
  { mode: 'deaf', label: 'Deaf / hard-of-hearing', hint: 'Visual and haptic lead' },
];

export function AssemblyToggleSheet({ visible, onClose }: AssemblyToggleSheetProps) {
  const isAssemblyPoint = useSettingsStore((state) => state.isAssemblyPoint);
  const setIsAssemblyPoint = useSettingsStore((state) => state.setIsAssemblyPoint);
  const accessibilityMode = useSettingsStore((state) => state.accessibilityMode);
  const setAccessibilityMode = useSettingsStore((state) => state.setAccessibilityMode);
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

          <Text className="mb-2 text-base font-semibold text-typography-900">
            Accessibility mode
          </Text>
          {MODE_OPTIONS.map((option) => {
            const isSelected = option.mode === accessibilityMode;
            return (
              <Pressable
                key={option.mode}
                onPress={() => setAccessibilityMode(option.mode)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${option.label}. ${option.hint}`}
                className={`mb-2 rounded-xl border px-4 py-3 ${
                  isSelected ? 'border-primary-500 bg-primary-50' : 'border-outline-200'
                }`}>
                <Text className="text-base font-medium text-typography-900">{option.label}</Text>
                <Text className="text-sm text-typography-600">{option.hint}</Text>
              </Pressable>
            );
          })}

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
