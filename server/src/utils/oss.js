const OSS = require('ali-oss');
const config = require('../config');

let stsClient = null;

function getStsClient() {
  if (!stsClient) {
    stsClient = new OSS.STS({
      accessKeyId: config.oss.accessKeyId,
      accessKeySecret: config.oss.accessKeySecret,
    });
  }
  return stsClient;
}

// 生成上传凭证（给前端直传用）
async function getUploadToken(uid, type = 'chat') {
  const sts = getStsClient();

  const policy = {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['oss:PutObject'],
        Resource: [`acs:oss:*:*:${config.oss.bucket}/${type}/${uid}/*`],
      },
    ],
  };

  const result = await sts.assumeRole(config.oss.roleArn, policy, 15 * 60);

  return {
    accessKeyId: result.credentials.AccessKeyId,
    accessKeySecret: result.credentials.AccessKeySecret,
    stsToken: result.credentials.SecurityToken,
    region: config.oss.region,
    bucket: config.oss.bucket,
    dir: `${type}/${uid}/`,
    domain: config.oss.domain,
  };
}

module.exports = {
  getUploadToken,
};
