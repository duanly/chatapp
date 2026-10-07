import request from './request';

// 上传文件（服务端中转，自动上传到 OSS）
export function uploadFile(type, file) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post(`/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 获取 OSS STS 凭证（预留接口）
export function getOssToken(type = 'chat') {
  return request.get('/upload/oss/token', { params: { type } });
}
