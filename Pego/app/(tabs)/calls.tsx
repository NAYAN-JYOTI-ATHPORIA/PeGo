import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const calls = [
  {
    id: '1',
    name: 'Rahul Sharma',
    time: 'Today, 10:30 AM',
    type: 'incoming',
    missed: false,
  },
  {
    id: '2',
    name: 'Priya Das',
    time: 'Today, 9:15 AM',
    type: 'outgoing',
    missed: false,
  },
  {
    id: '3',
    name: 'Amit Kumar',
    time: 'Yesterday, 8:45 PM',
    type: 'incoming',
    missed: true,
  },
  {
    id: '4',
    name: 'Neha Sharma',
    time: 'Yesterday, 6:20 PM',
    type: 'outgoing',
    missed: false,
  },
  {
    id: '5',
    name: 'Rohan Das',
    time: 'Sep 2, 4:10 PM',
    type: 'incoming',
    missed: false,
  },
];

const CallLog = () => {
  const renderCall = ({ item }: any) => {
    return (
      <TouchableOpacity
        style={styles.callItem}
        activeOpacity={0.7}
      >

        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0)}
          </Text>
        </View>

        {/* Call Information */}
        <View style={styles.callInfo}>
          <Text
            style={[
              styles.name,
              item.missed && styles.missedName,
            ]}
          >
            {item.name}
          </Text>

          <View style={styles.details}>
            <Ionicons
              name={
                item.type === 'incoming'
                  ? 'arrow-down'
                  : 'arrow-up'
              }
              size={15}
              color={
                item.missed
                  ? '#D32F2F'
                  : '#023E7D'
              }
            />

            <Text
              style={[
                styles.time,
                item.missed && styles.missedText,
              ]}
            >
              {item.time}
            </Text>
          </View>
        </View>

        {/* Call Button */}
        <TouchableOpacity
          style={styles.callButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="call"
            size={20}
            color="#023E7D"
          />
        </TouchableOpacity>

      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Calls
        </Text>
      </View>

      {/* Call List */}
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCall}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    height: 65,
    backgroundColor: '#023E7D',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
  },

  list: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  callItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E6ECF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    color: '#023E7D',
    fontSize: 20,
    fontWeight: '700',
  },

  callInfo: {
    flex: 1,
  },

  name: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },

  missedName: {
    color: '#D32F2F',
  },

  details: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  time: {
    color: '#777777',
    fontSize: 13,
    marginLeft: 5,
  },

  missedText: {
    color: '#D32F2F',
  },

  callButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E6ECF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CallLog;