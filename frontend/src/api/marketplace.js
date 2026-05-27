import client from './client';

export const getServiceFormFields = async (serviceId) => {
    const res = await client.get(`/services/${serviceId}/form-fields`);
    return res.data;
};

export const saveServiceFormFields = async (serviceId, fields) => {
    const res = await client.post(`/services/${serviceId}/form-fields`, fields);
    return res.data;
};

export const createOrder = async (orderData) => {
    const res = await client.post('/orders', orderData);
    return res.data;
};

export const getServiceResponses = async (serviceId) => {
    const res = await client.get(`/services/${serviceId}/responses`);
    return res.data;
};
