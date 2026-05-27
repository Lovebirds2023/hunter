import client from './client';

export const getEvents = async () => {
    const response = await client.get('/events');
    return response.data;
};

export const getEvent = async (id) => {
    const response = await client.get(`/events/${id}`);
    return response.data;
};

export const registerForEvent = async (eventId, data) => {
    const response = await client.post(`/events/${eventId}/register`, data);
    return response.data;
};

export const getMyRegistrations = async () => {
    const response = await client.get('/my-registrations');
    return response.data;
};

export const createEvent = async (data) => {
    const response = await client.post('/events', data);
    return response.data;
};

export const exportData = async (type, eventId) => {
    const params = { type };
    if (eventId) params.event_id = eventId;

    const response = await client.get('/admin/export', {
        params,
        responseType: 'blob', // Important for file download
    });
    return response;
};

// --- Bookmarks / Saved Events ---
export const toggleSaveEvent = async (eventId) => {
    const response = await client.post(`/events/${eventId}/save`);
    return response.data;
};

export const getSavedEvents = async () => {
    const response = await client.get('/saved-events');
    return response.data;
};

// --- Custom Form Builder ---
export const getEventFormFields = async (eventId) => {
    const response = await client.get(`/events/${eventId}/form-fields`);
    return response.data;
};

export const saveEventFormFields = async (eventId, fields) => {
    const response = await client.post(`/events/${eventId}/form-fields`, fields);
    return response.data;
};

export const getEventResponses = async (eventId) => {
    const response = await client.get(`/events/${eventId}/responses`);
    return response.data;
};
