import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'lime';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        sizeContainer[size],
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' || variant === 'destructive'
              ? AppColors.surface
              : AppColors.primary
          }
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSize[size]}
              color={getTextColor(variant, disabled)}
              style={styles.leftIcon}
            />
          )}
          <Text
            style={[
              styles.textBase,
              sizeText[size],
              { color: getTextColor(variant, disabled) },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={iconSize[size]}
              color={getTextColor(variant, disabled)}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

function getTextColor(variant: ButtonVariant, disabled?: boolean | null): string {
  if (disabled) return AppColors.textMuted;
  switch (variant) {
    case 'primary':
      return AppColors.surface;
    case 'secondary':
      return AppColors.primary;
    case 'lime':
      return AppColors.primary;
    case 'outline':
      return AppColors.primary;
    case 'ghost':
      return AppColors.textSecondary;
    case 'destructive':
      return AppColors.surface;
    default:
      return AppColors.surface;
  }
}

const iconSize: Record<ButtonSize, number> = {
  sm: 14,
  md: 18,
  lg: 20,
};

const sizeContainer: Record<ButtonSize, ViewStyle> = {
  sm: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  md: {
    minHeight: 46,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  lg: {
    minHeight: 54,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
};

const sizeText: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13, fontWeight: '600' },
  md: { fontSize: 15, fontWeight: '700' },
  lg: { fontSize: 16, fontWeight: '700' },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  textBase: {
    letterSpacing: -0.2,
  },
  // Variants
  primary: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  secondary: {
    backgroundColor: AppColors.cardAlt,
    borderColor: AppColors.border,
  },
  lime: {
    backgroundColor: AppColors.secondary,
    borderColor: AppColors.secondary,
    shadowColor: AppColors.lime,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  outline: {
    backgroundColor: AppColors.surface,
    borderColor: AppColors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: AppColors.danger,
    borderColor: AppColors.danger,
    shadowColor: AppColors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
});
