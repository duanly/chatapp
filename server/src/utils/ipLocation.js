const http = require('http');
const https = require('https');

// IP 归属地查询（使用 ip-api.com 免费接口，每分钟 45 次限制）
// 国内可用：ipinfo.io，或者自己接 IP 库
async function getIpLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return '内网IP';
  }

  try {
    const url = `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,country,regionName,city,isp`;
    const data = await httpGetJson(url);
    if (data.status === 'success') {
      const parts = [data.country, data.regionName, data.city].filter(Boolean);
      return parts.join(' · ');
    }
    return '未知';
  } catch (e) {
    console.error('ip location query failed:', e.message);
    return '未知';
  }
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject).setTimeout(3000, () => {
      reject(new Error('timeout'));
    });
  });
}

module.exports = { getIpLocation };
