/**
 * Themed primitives — default surfaces/text use equa palette via NativeWind;
 * optional lightColor/darkColor still map through the same tokens in Colors.
 */

import { Text as DefaultText, View as DefaultView } from 'react-native';

import Colors from '@/constants/Colors';
import { cn } from '@/src/lib/cn';

import { useColorScheme } from './useColorScheme';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

export function Text({ className, style, lightColor, darkColor, ...otherProps }: TextProps) {
  const hasColorOverride = lightColor != null || darkColor != null;
  const resolvedColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <DefaultText
      className={cn(
        !hasColorOverride && 'text-equa-ink dark:text-equa-cream',
        className,
      )}
      style={[hasColorOverride ? { color: resolvedColor } : undefined, style]}
      {...otherProps}
    />
  );
}

export function View({
  className,
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ViewProps) {
  const hasBgOverride = lightColor != null || darkColor != null;
  const resolvedBg = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return (
    <DefaultView
      className={cn(
        !hasBgOverride && 'bg-equa-cream dark:bg-equa-ink',
        className,
      )}
      style={[hasBgOverride ? { backgroundColor: resolvedBg } : undefined, style]}
      {...otherProps}
    />
  );
}
