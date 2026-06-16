export const CUSTOM_COUNTRY_CODE = '__custom_country_code__';

export const COUNTRY_CODES = [
    { label: 'Kenya (+254)', value: '+254' },
    { label: 'Uganda (+256)', value: '+256' },
    { label: 'Tanzania (+255)', value: '+255' },
    { label: 'Rwanda (+250)', value: '+250' },
    { label: 'Nigeria (+234)', value: '+234' },
    { label: 'South Africa (+27)', value: '+27' },
    { label: 'UK (+44)', value: '+44' },
    { label: 'USA (+1)', value: '+1' },
    { label: 'India (+91)', value: '+91' },
    { label: 'Spain (+34)', value: '+34' },
    { label: 'France (+33)', value: '+33' },
    { label: 'Germany (+49)', value: '+49' },
    { label: 'Brazil (+55)', value: '+55' },
    { label: 'UAE (+971)', value: '+971' },
    { label: 'China (+86)', value: '+86' },
    { label: 'Japan (+81)', value: '+81' },
];

export const formatCountryCode = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    return digits ? `+${digits}` : '';
};

export const isValidCountryCode = (value) => /^\+\d{1,4}$/.test(String(value || '').trim());

export const getCountryCodeSelection = (value) => (
    COUNTRY_CODES.some((country) => country.value === value)
        ? value
        : CUSTOM_COUNTRY_CODE
);
