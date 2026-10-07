import axios from 'axios';
import { ElMessage } from 'element-plus';

const service = axios.create({
  baseURL: '/api/admin',
  timeout: 15000,
});

service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

service.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data.code !== 0) {
      ElMessage.error(data.message || '请求失败');
      if (data.code === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
      }
      return Promise.reject(data);
    }
    return data.data;
  },
  (error) => {
    ElMessage.error(error.message || '网络错误');
    return Promise.reject(error);
  }
);

export default service;
