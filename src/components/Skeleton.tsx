import React from 'react';
import { Animated } from 'react-native';
import { Theme } from '../theme';

/** Pulsing placeholder block shown while content loads. */
export const Skeleton = ({ width, height, borderRadius = 8, style }: { width?: any; height: number; borderRadius?: number; style?: any }) => {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height,
          borderRadius,
          backgroundColor: Theme.colors.surfaceContainerHighest || '#e0e0e0',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};
