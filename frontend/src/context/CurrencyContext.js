import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api/client';

const CurrencyContext = createContext();

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
    const [rates, setRates] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const response = await axios.get(`${API_URL}/exchange-rates`);
                setRates(response.data.rates);
            } catch (error) {
                console.error("Failed to fetch exchange rates:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRates();
    }, []);

    // Helper to safely convert amounts. We assume base rates are relative to USD
    const convertPrice = (amount, fromCurrency, toCurrency) => {
        if (!rates || !amount) return amount;
        
        // If currencies are identical or both missing, return amount
        if (fromCurrency === toCurrency || !fromCurrency || !toCurrency) return amount;

        const rateFrom = rates[fromCurrency];
        const rateTo = rates[toCurrency];

        if (!rateFrom || !rateTo) return amount; // Fallback if rates absent

        // Convert amount to USD base, then to target currency
        const amountInUSD = amount / rateFrom;
        const finalAmount = amountInUSD * rateTo;

        return finalAmount;
    };

    // Helper to format currency correctly for UI
    const formatCurrency = (amount, currency = 'USD') => {
        if (amount === undefined || amount === null) return '';
        
        // Fallback robust formatting depending on locale
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    return (
        <CurrencyContext.Provider value={{ rates, isLoading, convertPrice, formatCurrency }}>
            {children}
        </CurrencyContext.Provider>
    );
};
