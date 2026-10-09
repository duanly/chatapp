import request from './request';

// STS 凭证缓存
let stsCache = null;
let stsExpireTime = 0;

/**
 * 获取 OSS STS 临时凭证（带缓存）
 */
async function getStsToken(type = 'chat') {
  const now = Date.now();
  // 凭证还有 1 分钟以上有效期就复用
  if (stsCache && stsExpireTime - now > 60 * 1000 && stsCache.type === type) {
    return stsCache;
  }

  try {
    const data = await request.get('/upload/oss/token', { params: { type } });
    stsCache = { ...data, type };
    // 提前 30 分钟过期（STS 有效期 12 小时）
    stsExpireTime = now + 11.5 * 60 * 60 * 1000;
    return stsCache;
  } catch (e) {
    // STS 获取失败，返回 null，调用方 fallback 到服务端上传
    return null;
  }
}

/**
 * 直传文件到 OSS
 */
async function uploadToOSS(file, type = 'chat') {
  const OSS = (await import('ali-oss')).default;

  const sts = await getStsToken(type);
  if (!sts) return null;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const objectName = `${sts.dir}${filename}`;

  const client = new OSS({
    region: sts.region,
    accessKeyId: sts.accessKeyId,
    accessKeySecret: sts.accessKeySecret,
    stsToken: sts.stsToken,
    bucket: sts.bucket,
    secure: true,
  });

  const result = await client.put(objectName, file);

  // 返回 URL
  let url;
  if (sts.domain) {
    url = `${sts.domain}/${objectName}`;
  } else {
    url = result.url;
  }

  return {
    url,
    filename,
    size: file.size,
  };
}

/**
 * 上传文件（优先 OSS 直传，失败则走服务端中转）
 */
export async function uploadFile(type, file) {
  // 尝试直传 OSS
  try {
    const result = await uploadToOSS(file, type);
    if (result) {
      return result;
    }
  } catch (e) {
    console.warn('OSS 直传失败，fallback 到服务端上传:', e.message);
  }

  // fallback：服务端中转
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
