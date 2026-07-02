import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './src/i18n';
import { Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { useAppUpdateCheck } from './src/hooks/useAppUpdateCheck';
import UpdateModal from './src/components/UpdateModal';
import * as WebBrowser from 'expo-web-browser';
import AppErrorBoundary from './src/components/AppErrorBoundary';

// Intercept auth redirects globally
WebBrowser.maybeCompleteAuthSession();

import LoginScreen from './src/screens/LoginScreen.js';
import RegisterScreen from './src/screens/RegisterScreen.js';
import GoogleAuthCallbackScreen from './src/screens/GoogleAuthCallbackScreen.js';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen.js';
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
import ScorecardSurveyScreen from './src/screens/ScorecardSurveyScreen';
import { COLORS } from './src/constants/theme';
import { PlatformDisclaimerModal } from './src/components/PlatformDisclaimerModal';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const EventStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const CaseStack = createNativeStackNavigator();

const getCurrentWebOrigin = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    return window.location.origin;
};

const getLinkingPrefixes = () => {
    const prefixes = [
        getCurrentWebOrigin(),
        'https://hunter-k9lr.vercel.app',
        'https://lovedogs360.co.ke',
        'https://www.lovedogs360.co.ke',
        'https://lovedogs360.com',
        'https://www.lovedogs360.com',
        'http://localhost:19006',
        'lovedogs360://',
    ];

    return Array.from(new Set(prefixes.filter(Boolean)));
};

// Web URL → Screen linking configuration
const linking = {
    prefixes: getLinkingPrefixes(),
    config: {
        screens: {
            Login: 'login',
            GoogleAuthCallback: 'auth/google',
            ForgotPassword: 'forgot-password',
            ResetPassword: 'reset-password',
            Onboarding: 'onboarding',
            Register: 'register',
            Main: {
                screens: {
                    Home: 'home',
                    Marketplace: 'marketplace',
                    Events: {
                        screens: {
                            EventsList: 'events',
                            EventDetail: 'events/:eventId',
                            ScorecardSurvey: 'events/:eventId/scorecard/:surveyType',
                            MyRegistrations: 'my-registrations',
                        },
                    },
                    Report: {
                        screens: {
                            CaseFeed: 'cases',
                            ReportCase: 'cases/report',
                            CaseDetail: 'cases/:reportId',
                        },
                    },
                    Community: 'community',
                    Payouts: 'payouts',
                    Profile: 'profile',
                },
            },
            OrderReceipt: 'receipt/:orderId?',
            CreateService: 'create-service',
            DogRegistration: 'dog-registration',
            LostFound: 'lost-found',
            WellnessHub: 'wellness',
            Support: 'support',
            Inbox: 'inbox',
            AdminDashboard: {
                screens: {
                    AdminHome: 'admin',
                },
            },
        },
    },
};

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
            <EventStack.Screen name="ScorecardSurvey" component={ScorecardSurveyScreen} />
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
            <Tab.Screen name="Community" component={CommunityHubScreen} options={{ tabBarLabel: t('navigation.community') }} />
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
            <AdminStack.Screen name="ScorecardSurvey" component={ScorecardSurveyScreen} />
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
                    <Stack.Screen name="GoogleAuthCallback" component={GoogleAuthCallbackScreen} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="ResetPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </>
            ) : isAdmin ? (
                <>
                    <Stack.Screen name="GoogleAuthCallback" component={AdminNavigator} />
                    <Stack.Screen name="AdminDashboard" component={AdminNavigator} />
                </>
            ) : (
                <>
                    <Stack.Screen name="GoogleAuthCallback" component={MainTabs} />
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
    const { t } = useTranslation();
    const [updateModalVisible, setUpdateModalVisible] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [isRequiredUpdate, setIsRequiredUpdate] = useState(false);

    const APP_VERSION = '1.0.2'; // Should match package.json

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
        const styleId = 'ld360-responsive-root';
        if (document.getElementById(styleId)) return undefined;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            html, body, #root {
                width: 100%;
                min-height: 100%;
                margin: 0;
                overflow-x: hidden;
            }
            #root {
                display: flex;
                flex-direction: column;
            }
            *, *::before, *::after {
                box-sizing: border-box;
            }
        `;
        document.head.appendChild(style);

        return () => {
            style.remove();
        };
    }, []);

    // Check for app updates on startup
    useAppUpdateCheck(
        APP_VERSION,
        (versionInfo) => {
            // Optional update available
            setUpdateInfo(versionInfo);
            setIsRequiredUpdate(false);
            setUpdateModalVisible(true);
        },
        (versionInfo) => {
            // Critical update required
            setUpdateInfo(versionInfo);
            setIsRequiredUpdate(true);
            setUpdateModalVisible(true);
            
            // Alert user for critical updates
            Alert.alert(
                t('app_update.critical_required'),
                t('app_update.critical_required_message'),
                [{ text: t('common.ok') }],
                { cancelable: false }
            );
        }
    );

    return (
        <AuthProvider>
            <SyncProvider>
                <CurrencyProvider>
                    <AppErrorBoundary>
                        <NavigationContainer linking={linking}>
                            <AppNavigator />
                            <PlatformDisclaimerModal />
                            <UpdateModal
                                visible={updateModalVisible}
                                versionInfo={updateInfo}
                                isRequired={isRequiredUpdate}
                                onClose={() => {
                                    if (!isRequiredUpdate) {
                                        setUpdateModalVisible(false);
                                    }
                                }}
                                onUpdate={() => {
                                    setUpdateModalVisible(false);
                                }}
                            />
                        </NavigationContainer>
                    </AppErrorBoundary>
                </CurrencyProvider>
            </SyncProvider>
        </AuthProvider>
    );
}
