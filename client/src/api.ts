import axios from 'axios';

const API_URL = '/api';

export const getDemos = async () => {
    const response = await axios.get(`${API_URL}/demos`);
    return response.data;
};

export const getDemoDetails = async (filename: string) => {
    const response = await axios.get(`${API_URL}/demos/${filename}`);
    return response.data;
};

export const getPositions = async (filename: string, startTick: number, endTick: number, interval: number = 1) => {
    const response = await axios.get(`${API_URL}/demos/${filename}/positions`, {
        params: { startTick, endTick, interval }
    });
    return response.data;
};

export const getMapDetails = async (mapName: string) => {
    const response = await axios.get(`${API_URL}/maps/${mapName}`);
    return response.data;
};

export const verifyAdminPassword = async (password: string) => {
    const response = await axios.post(`${API_URL}/auth/verify`, null, {
        headers: { 'x-admin-password': password }
    });
    return response.data;
};

export const uploadDemo = async (file: File, password: string, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('demo', file);

    const response = await axios.post(`${API_URL}/demos/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'x-admin-password': password,
        },
        onUploadProgress: (event) => {
            if (event.total && onProgress) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        }
    });
    return response.data;
};

export const deleteDemo = async (filename: string, password: string) => {
    const response = await axios.delete(`${API_URL}/demos/${filename}`, {
        headers: { 'x-admin-password': password }
    });
    return response.data;
};