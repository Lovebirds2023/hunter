import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import './src/i18n';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { CurrencyProvider } from './src/context/CurrencyContext';

import LoginScreen from './src/screens/LoginScreen.js';
import RegisterScreen from './src/screens/RegisterScreen.js';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { DogIdentityScreen } from './src/screens/DogIdentityScreen';
import { PayoutsScreen } from './src/screens/PayoutsScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { EventDetailScreen } from './src/screens/EventDetailScreen';
import { MyRegistrationsScreen } from './src/screens/MyRegistrationsScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import CreateServiceScreen from './src/screens/CreateServiceScreen';
import { OrderReceiptScreen } from './src/screens/OrderReceiptScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DogDetailsScreen } from './src/screens/DogDetailsScreen';
import { AddHealthRecordScreen } from './src/screens/AddHealthRecordScreen';
import CaseFeedScreen from './src/screens/CaseFeedScreen';
import ReportCaseScreen from './src/screens/ReportCaseScreen';
import CaseDetailScreen from './src/screens/CaseDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import LostFoundScreen from './src/screens/LostFoundScreen';
import { WellnessHubScreen } from './src/screens/WellnessHubScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ProgramJourneyScreen } from './src/screens/ProgramJourneyScreen';
import { HealthPassportScreen } from './src/screens/HealthPassportScreen';
import { CommunityHubScreen } from './src/screens/CommunityHubScreen';
import { DirectMessageScreen } from './src/screens/DirectMessageScreen';
import { FacilitatorDashboardScreen } from './src/screens/FacilitatorDashboardScreen';


import { VetDashboardScreen } from './src/screens/VetDashboardScreen';
import { AdminProgramReportsScreen } from './src/screens/AdminProgramReportsScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { InboxScreen } from './src/screens/InboxScreen';
import ServiceFormBuilderScreen from './src/screens/ServiceFormBuilderScreen';
import ServiceResponsesScreen from './src/screens/ServiceResponsesScreen';
import EventFormBuilderScreen from './src/screens/EventFormBuilderScreen';
import EventResponsesScreen from './src/screens/EventResponsesScreen';
import { COLORS } from './src/constants/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const EventStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const CaseStack = createNativeStackNavigator();

function CaseStackScreen() {
    return (
        <CaseStack.Navigator screenOptions={{ headerShown: false }}>
            <CaseStack.Screen name="CaseFeed" component={CaseFeedScreen} />
            <CaseStack.Screen name="ReportCase" component={ReportCaseScreen} />
            <CaseStack.Screen name="CaseDetail" component={CaseDetailScreen} />
        </CaseStack.Navigator>
    );
}

function EventsStackScreen() {
    return (
        <EventStack.Navigator screenOptions={{ headerShown: false }}>
            <EventStack.Screen name="EventsList" component={EventsScreen} />
            <EventStack.Screen name="EventDetail" component={EventDetailScreen} />
            <EventStack.Screen name="MyRegistrations" component={MyRegistrationsScreen} />
            <EventStack.Screen name="EventFormBuilder" component={EventFormBuilderScreen} />
            <EventStack.Screen name="EventResponses" component={EventResponsesScreen} />
        </EventStack.Navigator>
    );
}

function MainTabs() {
    const { t } = useTranslation();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Marketplace') iconName = focused ? 'cart' : 'cart-outline';
                    else if (route.name === 'Report') iconName = focused ? 'megaphone' : 'megaphone-outline';
                    else if (route.name === 'Community') iconName = focused ? 'people' : 'people-outline';
                    else if (route.name === 'Payouts') iconName = focused ? 'wallet' : 'wallet-outline';

                    else if (route.name === 'Events') iconName = focused ? 'calendar' : 'calendar-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.white,
                tabBarStyle: { backgroundColor: COLORS.primary },
                headerShown: false,
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('navigation.home') }} />
            <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarLabel: t('navigation.marketplace') }} />
            <Tab.Screen name="Events" component={EventsStackScreen} options={{ tabBarLabel: t('navigation.events') }} />
            <Tab.Screen name="Report" component={CaseStackScreen} options={{ tabBarLabel: t('navigation.report') }} />
            <Tab.Screen name="Community" component={CommunityHubScreen} options={{ tabBarLabel: 'Community' }} />
            <Tab.Screen name="Payouts" component={PayoutsScreen} options={{ tabBarLabel: t('navigation.payouts') }} />

            <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('navigation.profile') }} />
        </Tab.Navigator>
    );
}

function AdminNavigator() {
    return (
        <AdminStack.Navigator screenOptions={{ headerShown: false }}>
            <AdminStack.Screen name="AdminHome" component={AdminDashboardScreen} />
            <AdminStack.Screen name="CreateService" component={CreateServiceScreen} />
            <AdminStack.Screen name="ServiceFormBuilder" component={ServiceFormBuilderScreen} />
            <AdminStack.Screen name="ServiceResponses" component={ServiceResponsesScreen} />
            <AdminStack.Screen name="AdminProgramReports" component={AdminProgramReportsScreen} />
            <AdminStack.Screen name="EventFormBuilder" component={EventFormBuilderScreen} />
            <AdminStack.Screen name="EventResponses" component={EventResponsesScreen} />
            <AdminStack.Screen name="FacilitatorDashboard" component={FacilitatorDashboardScreen} />
        </AdminStack.Navigator>
    );
}

function AppNavigator() {
    const { userToken, isAdmin } = useContext(AuthContext);

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!userToken ? (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </>
            ) : isAdmin ? (
                <Stack.Screen name="AdminDashboard" component={AdminNavigator} />
            ) : (
                <>
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    <Stack.Screen name="CreateService" component={CreateServiceScreen} />
                    <Stack.Screen name="ServiceFormBuilder" component={ServiceFormBuilderScreen} />
                    <Stack.Screen name="ServiceResponses" component={ServiceResponsesScreen} />
                    <Stack.Screen name="OrderReceipt" component={OrderReceiptScreen} />
                    <Stack.Screen name="DogDetails" component={DogDetailsScreen} />
                    <Stack.Screen name="AddHealthRecord" component={AddHealthRecordScreen} />
                    <Stack.Screen name="DogRegistration" component={DogIdentityScreen} />
                    <Stack.Screen name="LostFound" component={LostFoundScreen} />
                    <Stack.Screen name="WellnessHub" component={WellnessHubScreen} />
                    <Stack.Screen name="ProgramJourney" component={ProgramJourneyScreen} />
                    <Stack.Screen name="HealthPassport" component={HealthPassportScreen} />
                    <Stack.Screen name="DirectMessage" component={DirectMessageScreen} />
                    <Stack.Screen name="FacilitatorDashboard" component={FacilitatorDashboardScreen} />

                    <Stack.Screen name="VetDashboard" component={VetDashboardScreen} />
                    <Stack.Screen name="Support" component={SupportScreen} />
                    <Stack.Screen name="Inbox" component={InboxScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <SyncProvider>
                <CurrencyProvider>
                    <NavigationContainer>
                        <AppNavigator />
                    </NavigationContainer>
                </CurrencyProvider>
            </SyncProvider>
        </AuthProvider>
    );
}
