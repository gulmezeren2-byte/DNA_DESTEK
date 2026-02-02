import React from 'react';
import { ActivityIndicator, View } from 'react-native';

// This file exists to satisfy the router for the root path "/"
// The logic in app/_layout.tsx will handle the actual redirection.
export default function Index() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#000" />
        </View>
    );
}
