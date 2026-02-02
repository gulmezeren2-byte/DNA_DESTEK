import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TextStyle } from 'react-native';

interface StatsTickerProps {
    value: number;
    style?: TextStyle;
    duration?: number;
    suffix?: string;
    prefix?: string;
}

export const StatsTicker = ({ value, style, duration = 2000, suffix = '', prefix = '' }: StatsTickerProps) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const listener = animatedValue.addListener(({ value }) => {
            setDisplayValue(Math.floor(value));
        });

        Animated.timing(animatedValue, {
            toValue: value,
            duration: duration,
            useNativeDriver: true,
        }).start();

        return () => {
            animatedValue.removeListener(listener);
        };
    }, [value]);

    return (
        <Text style={style}>
            {prefix}{displayValue}{suffix}
        </Text>
    );
};
