import { Tabs } from 'expo-router';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const W = Dimensions.get('window').width;
const TAB_W = W / 3;

const BLUE = '#023E7D';
const GRAY = '#8E8E93';
const BG = '#E6ECF3';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const x = React.useRef(new Animated.Value(state.index)).current;

  React.useEffect(() => {
    Animated.spring(x, {
      toValue: state.index,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [state.index]);

  const translateX = x.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, TAB_W, TAB_W * 2],
  });

  return (
    <View style={styles.bar}>
      {/* Sliding background box */}
      <Animated.View
        style={[
          styles.indicator,
          {
            transform: [{ translateX }],
          },
        ]}
      />

      {state.routes.map((route: any, i: number) => {
        const { options } = descriptors[route.key];

        const focused = state.index === i;
        const color = focused ? BLUE : GRAY;

        return (
          <Pressable
            key={route.key}
            style={styles.tab}
            onPress={() => {
              if (!focused) {
                navigation.navigate(route.name);
              }
            }}
          >
            {/* Icon */}
            {options.tabBarIcon?.({
              focused,
              color,
              size: 25,
            })}

            {/* Label */}
            <Text style={[styles.label, { color }]}>
              {options.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Chats */}
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="chatbubbles"
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Calls */}
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="call"
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="account-circle"
              size={27}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 70,
    width: W,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',

    borderTopWidth: 1,
    borderTopColor: '#eee',

    elevation: 8,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },

  // Moving rounded box
  indicator: {
    position: 'absolute',
    left: 9,
    top: 8,

    width: TAB_W - 18,
    height: 54,

    borderRadius: 14,
    backgroundColor: BG,
  },

  // Each tab
  tab: {
    width: TAB_W,
    height: 54,

    alignItems: 'center',
    justifyContent: 'center',

    zIndex: 1,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});