import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
    FadeInDown,
    FadeOut,
    Layout
} from 'react-native-reanimated';

interface AnimatedItemProps {
    children: React.ReactNode;
    index: number;
    delay?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * Listeler için giriş animasyonu sağlayan sarmalayıcı bileşen.
 * Her öğe index'ine göre gecikmeli olarak (staggered) gelir.
 */
export const AnimatedItem: React.FC<AnimatedItemProps> = ({
    children,
    index,
    delay = 50,
    style
}) => {
    return (
        <Animated.View
            entering={FadeInDown.delay(index * delay).springify().damping(12)}
            exiting={FadeOut}
            layout={Layout.springify()}
            style={style}
        >
            {children}
        </Animated.View>
    );
};

export const FadeInView: React.FC<{ children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }> = ({ children, delay = 0, style }) => {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(600)}
            style={style}
        >
            {children}
        </Animated.View>
    );
}

export default AnimatedItem;
