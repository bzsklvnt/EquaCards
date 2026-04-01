import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

import { useClientOnlyValue } from '@/src/hooks/useClientOnlyValue';
import { useColorScheme } from '@/src/hooks/useColorScheme';
import { navigationColors } from '@/src/theme/navigationColors';
import { useAuthorization } from '@/src/features/auth/AuthorizationProvider';
import { ROLE } from '@/src/features/auth/roles';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -2 }} {...props} />;
}

export default function AppTabsLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = navigationColors[scheme];
  const { hasRole } = useAuthorization();
  const showAdmin = hasRole(ROLE.Admin);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor:
            scheme === 'dark' ? 'rgba(247, 243, 235, 0.12)' : 'rgba(28, 25, 23, 0.08)',
        },
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerShadowVisible: scheme === 'light',
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="study"
        options={{
          title: 'Study',
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: showAdmin ? '/admin' : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
