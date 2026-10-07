import axios from 'axios';
import { showToast } from 'vant';

const service = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

// 请求拦截
service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截
service.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data.code !== 0) {
      showToast(data.message || '请求失败');
      if (data.code === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        window.location.href = '/login';
      }
      return Promise.reject(data);
    }
    return data.data;
  },
  (error) => {
    showToast(error.message || '网络错误');
    return Promise.reject(error);
  }
);

export default service;
