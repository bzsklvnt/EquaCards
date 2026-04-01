import type { ReactNode } from 'react';
import { View } from 'react-native';

type Props = {
  children: ReactNode;
};

/**
 * Centers app content on wide viewports (web/tablet) while staying full-width on phones.
 * `min-h-0` / `min-w-0` avoid common web flex overflow issues inside column layouts.
 */
export function ResponsiveShell({ children }: Props) {
  return (
    <View
      className="flex-1 w-full min-h-0 min-w-0 max-w-full items-center bg-equa-cream dark:bg-equa-ink"
      testID="responsive-shell"
    >
      <View className="flex-1 w-full min-h-0 min-w-0 max-w-content self-center">
        {children}
      </View>
    </View>
  );
}
