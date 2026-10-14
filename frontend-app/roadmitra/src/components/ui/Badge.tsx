import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
  onPress?: () => void;
  loading?: boolean;
}

export function Badge({ label, color = '#3D8EFF', textColor = '#FFFFFF', style, onPress, loading }: BadgeProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.badge, { backgroundColor: color }, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: color }, style]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
