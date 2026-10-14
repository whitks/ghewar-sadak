import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/theme';

interface WaveformChartProps {
  data: number[];
  label?: string;
  color?: string;
}

export function WaveformChart({ data, label, color = AppColors.teal }: WaveformChartProps) {
  const maxVal = Math.max(...data, 0.01);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chart}>
        {data.map((v, i) => {
          const height = Math.max(3, (v / maxVal) * 56);
          return (
            <View
              key={i}
              style={[styles.bar, { height, backgroundColor: color }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { color: AppColors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 2,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 12,
    padding: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.borderLight,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
});
