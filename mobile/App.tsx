import React, { useEffect } from 'react';
import { StatusBar, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ShieldCheck, User } from 'lucide-react-native';
import { useStore } from './src/lib/store';
import { dark, typography } from './src/constants/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ThemeToggle } from './src/components/ThemeToggle';
import { Button } from './src/components/Button';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const user = useStore((s) => s.user);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const logout = useStore((s) => s.logout);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case 'Dashboard': return <LayoutDashboard size={size} color={color} />;
            case 'Admin': return <ShieldCheck size={size} color={color} />;
            case 'Profile': return <User size={size} color={color} />;
          }
        },
        tabBarStyle: {
          backgroundColor: dark.surface,
          borderTopColor: dark.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: dark.primary,
        tabBarInactiveTintColor: dark.textSecondary,
        tabBarLabelStyle: {
          fontFamily: typography.fontFamilyMedium,
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: dark.surface,
        },
        headerTintColor: dark.textPrimary,
        headerTitleStyle: {
          fontFamily: typography.fontFamilyBold,
          color: dark.heading,
        },
        headerRight: () => (
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        ),
        headerLeft: () => (
          <Button
            title="Logout"
            variant="ghost"
            size="sm"
            onPress={() => { void logout(); }}
            textStyle={{ color: dark.textSecondary }}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerTitle: 'Pothole Reporter' }}
      />
      {user?.role === 'admin' && (
        <Tab.Screen name="Admin" component={AdminScreen} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={loadingStyles.container}>
      <ActivityIndicator size="large" color={dark.primary} />
      <Text style={loadingStyles.text}>Loading...</Text>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.base,
    color: dark.textSecondary,
  },
});

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const isHydrated = useStore((s) => s.isHydrated);
  const hydrate = useStore((s) => s.hydrate);
  const theme = useStore((s) => s.theme);

  useEffect(() => { hydrate(); }, []);

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={dark.background}
      />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: true, headerTitle: '', headerStyle: { backgroundColor: dark.background }, headerTintColor: dark.textPrimary }}
            />
          </>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
