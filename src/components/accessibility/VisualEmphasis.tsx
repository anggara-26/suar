import { View, type ViewProps } from 'react-native';
import { useAccessibilityMode } from '@/src/hooks/useAccessibilityMode';

interface VisualEmphasisProps extends ViewProps {
  children: React.ReactNode;
  /** Extra classes applied only while bigVisual is active (Deaf/standard modes). */
  emphasizedClassName?: string;
}

/** Wraps content that should grow/gain contrast when bigVisual is on (Deaf/standard modes). */
export function VisualEmphasis({
  children,
  className,
  emphasizedClassName = '',
  ...props
}: VisualEmphasisProps) {
  const { bigVisual } = useAccessibilityMode();

  return (
    <View
      className={`${className ?? ''} ${bigVisual ? emphasizedClassName : ''}`.trim()}
      {...props}>
      {children}
    </View>
  );
}
