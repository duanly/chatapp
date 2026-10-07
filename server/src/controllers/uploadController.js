const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// ========== 本地上传（fallback） ==========
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function ensureDir(dir) {
  const full = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
  return full;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'chat';
    const dir = ensureDir(type);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uid = req.user?.uid || 'unknown';
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}_${uid}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const type = req.params.type || 'chat';
  if (type === 'avatar' || type === 'chat') {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只允许上传图片'), false);
    }
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 本地上传接口（OSS STS 不可用时的 fallback）
async function uploadFile(req, res) {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('upload error:', err);
      return res.json({ code: 400, message: err.message || '上传失败' });
    }
    if (!req.file) {
      return res.json({ code: 400, message: '请选择文件' });
    }

    const type = req.params.type || 'chat';
    let fileUrl;

    // 如果配置了 OSS，上传到 OSS
    if (hasOSS()) {
      try {
        fileUrl = await uploadToOSS(req.file.path, type, req.file.filename);
      } catch (ossErr) {
        console.error('OSS upload error:', ossErr);
        fileUrl = `/uploads/${type}/${req.file.filename}`;
      }
    } else {
      fileUrl = `/uploads/${type}/${req.file.filename}`;
    }

    res.json({
      code: 0,
      message: '上传成功',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size,
      },
    });
  });
}

// ========== OSS 服务端中转（无 STS 时用） ==========
let ossClient = null;
function getOSSClient() {
  if (ossClient) return ossClient;
  if (!config.oss?.accessKeyId || !config.oss?.accessKeySecret || !config.oss?.bucket) {
    return null;
  }
  const OSS = require('ali-oss');
  ossClient = new OSS({
    region: config.oss.region || 'oss-cn-shenzhen',
    accessKeyId: config.oss.accessKeyId,
    accessKeySecret: config.oss.accessKeySecret,
    bucket: config.oss.bucket,
    secure: true,
  });
  return ossClient;
}

function hasOSS() {
  return !!getOSSClient();
}

async function uploadToOSS(localPath, type, filename) {
  const client = getOSSClient();
  const objectName = `${type}/${filename}`;
  const result = await client.put(objectName, localPath);
  let url = config.oss.domain ? `${config.oss.domain}/${objectName}` : result.url;
  try { fs.unlinkSync(localPath); } catch (e) {}
  return url;
}

// ========== OSS STS 直传 ==========
function hasSTS() {
  return config.oss?.accessKeyId
    && config.oss?.accessKeySecret
    && config.oss?.bucket
    && config.oss?.roleArn;
}

// 获取 STS 上传凭证（前端直传用）
async function getOssToken(req, res) {
  try {
    if (!hasSTS()) {
      return res.json({ code: 400, message: 'OSS STS 未配置完整' });
    }

    const OSS = require('ali-oss');
    const sts = new OSS.STS({
      accessKeyId: config.oss.accessKeyId,
      accessKeySecret: config.oss.accessKeySecret,
    });

    const type = req.query.type || 'chat';
    const uid = req.user.uid;

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

    res.json({
      code: 0,
      data: {
        accessKeyId: result.credentials.AccessKeyId,
        accessKeySecret: result.credentials.AccessKeySecret,
        stsToken: result.credentials.SecurityToken,
        region: config.oss.region || 'oss-cn-shenzhen',
        bucket: config.oss.bucket,
        domain: config.oss.domain || '',
        dir: `${type}/${uid}/`,
      },
    });
  } catch (err) {
    console.error('getOssToken error:', err);
    // STS 失败就返回错误，前端会自动 fallback 到服务端上传
    res.json({ code: 500, message: '获取上传凭证失败' });
  }
}

module.exports = {
  uploadFile,
  getOssToken,
};
