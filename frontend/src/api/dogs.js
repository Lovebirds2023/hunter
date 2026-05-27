import client from './client';

export const getMyDogs = async () => {
    const response = await client.get('/my-dogs');
    return response.data;
};
