import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useCart } from '../../../../context/cartContext';

function CartIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { itemCount } = useCart();
  return (
    <View style={styles.cartIconWrapper}>
      <Feather name="shopping-cart" size={24} color={color} />
      {itemCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
        </View>
      )}
    </View>
  );
}

function TabBarIcon({
  focused,
  color,
  activeName,
  inactiveName,
}: {
  focused: boolean;
  color: ColorValue;
  activeName: React.ComponentProps<typeof Ionicons>['name'];
  inactiveName: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Ionicons name={focused ? activeName : inactiveName} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#EA580C',
          tabBarInactiveTintColor: '#A8A29E',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#FED7AA',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: 72,
            paddingTop: 8,
            paddingBottom: 10,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 10,
            shadowColor: '#451A03',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="Home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon focused={focused} color={color} activeName="home" inactiveName="home-outline" />
            ),
            tabBarLabel: ({ focused, children }) => (
              <View style={styles.labelWrap}>
                <Text style={[styles.label, { color: focused ? '#EA580C' : '#A8A29E' }]}>{children}</Text>
                {focused && <View style={styles.activeIndicator} />}
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="Activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon focused={focused} color={color} activeName="time" inactiveName="time-outline" />
            ),
            tabBarLabel: ({ focused, children }) => (
              <View style={styles.labelWrap}>
                <Text style={[styles.label, { color: focused ? '#EA580C' : '#A8A29E' }]}>{children}</Text>
                {focused && <View style={styles.activeIndicator} />}
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="Chat"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon focused={focused} color={color} activeName="chatbubble" inactiveName="chatbubble-outline" />
            ),
            tabBarLabel: ({ focused, children }) => (
              <View style={styles.labelWrap}>
                <Text style={[styles.label, { color: focused ? '#EA580C' : '#A8A29E' }]}>{children}</Text>
                {focused && <View style={styles.activeIndicator} />}
              </View>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7ED',
  },
  iconContainer: {
    width: 46,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  iconContainerActive: {
    backgroundColor: '#FFF1E6',
  },
  labelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeIndicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#EA580C',
    marginTop: 3,
  },
  cartIconWrapper: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EA580C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});