import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import DogRegistrationScreen from '../screens/DogRegistrationScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import LostFoundScreen from '../screens/LostFoundScreen';
import CreateServiceScreen from '../screens/CreateServiceScreen';
import { EventsScreen } from '../screens/EventsScreen'; // Check if named export
import EventDetailScreen from '../screens/EventDetailScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import { DogIdentityScreen } from '../screens/DogIdentityScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { InboxScreen } from '../screens/InboxScreen';
import SavedEventsScreen from '../screens/SavedEventsScreen';
import EventFormBuilderScreen from '../screens/EventFormBuilderScreen';
import EventResponsesScreen from '../screens/EventResponsesScreen';
import ServiceFormBuilderScreen from '../screens/ServiceFormBuilderScreen';
import ServiceResponsesScreen from '../screens/ServiceResponsesScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const { userToken, isAdmin } = useContext(AuthContext);

    return (
        <Stack.Navigator>
            {userToken === null ? (
                // Auth Stack
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </>
            ) : (
                // App Stack
                <>
                    {isAdmin ? (
                        <>
                            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                            <Stack.Screen name="Home" component={HomeScreen} />
                        </>
                    ) : (
                        <>
                            <Stack.Screen name="Home" component={HomeScreen} />
                            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                        </>
                    )}
                    <Stack.Screen name="DogRegistration" component={DogRegistrationScreen} />
                    <Stack.Screen name="DogIdentity" component={DogIdentityScreen} />
                    <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
                    <Stack.Screen name="CreateService" component={CreateServiceScreen} />
                    <Stack.Screen name="Events" component={EventsScreen} />
                    <Stack.Screen name="EventDetail" component={EventDetailScreen} />
                    <Stack.Screen name="SavedEvents" component={SavedEventsScreen} options={{ title: 'Saved Events' }} />
                    <Stack.Screen name="EventFormBuilder" component={EventFormBuilderScreen} options={{ title: 'Form Builder' }} />
                    <Stack.Screen name="EventResponses" component={EventResponsesScreen} options={{ title: 'Responses' }} />
                    <Stack.Screen name="ServiceFormBuilder" component={ServiceFormBuilderScreen} options={{ title: 'Registration Builder' }} />
                    <Stack.Screen name="ServiceResponses" component={ServiceResponsesScreen} options={{ title: 'Registration Responses' }} />
                    <Stack.Screen name="LostFound" component={LostFoundScreen} />
                    <Stack.Screen name="Support" component={SupportScreen} />
                    <Stack.Screen name="Inbox" component={InboxScreen} />
                </>
            )}
        </Stack.Navigator>
    );
};

export default AppNavigator;
