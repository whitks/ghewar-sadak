import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, Pressable } from 'react-native';
import { AppColors } from '../../constants/theme';

export type CardVariant = 'elevated' | 'outlined' | 'filled' | 'cardAlt';

export interface CardProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  title?: string;
  subtitle?: string;
  variant?: CardVariant;
  onPress?: () => void;
}

export function Card({
  children,
  style,
  title,
  subtitle,
  variant = 'elevated',
  onPress,
}: CardProps) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        style,
      ]}
    >
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  elevated: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  filled: {
    backgroundColor: AppColors.surface,
    borderWidth: 0,
  },
  cardAlt: {
    backgroundColor: AppColors.cardAlt,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  header: {
    marginBottom: 10,
    gap: 2,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
