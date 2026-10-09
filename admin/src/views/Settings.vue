<template>
  <div class="settings-page">
    <el-card class="setting-card">
      <template #header>
        <span>APP 设置</span>
      </template>

      <el-form :model="form" label-width="100px" style="max-width: 600px">
        <el-form-item label="APP 名称">
          <el-input v-model="form.app_name" placeholder="请输入APP名称" maxlength="20" />
        </el-form-item>

        <el-form-item label="APP Logo">
          <div class="logo-upload">
            <div v-if="form.app_logo" class="logo-preview" @click="handleUpload">
              <img :src="form.app_logo" alt="logo" />
              <div class="logo-mask">点击更换</div>
            </div>
            <el-upload
              v-else
              class="logo-uploader"
              :show-file-list="false"
              :before-upload="beforeUpload"
              :http-request="uploadLogo"
              accept="image/*"
            >
              <div class="upload-placeholder">
                <el-icon :size="32" color="#999"><Plus /></el-icon>
                <div style="color:#999; margin-top: 4px; font-size: 12px">上传Logo</div>
              </div>
            </el-upload>
            <div v-if="form.app_logo" style="margin-left: 12px; color: #999; font-size: 12px">
              建议尺寸：512x512，PNG/SVG 格式
            </div>
          </div>
        </el-form-item>

        <el-form-item label="APP 描述">
          <el-input
            v-model="form.app_description"
            type="textarea"
            :rows="3"
            placeholder="请输入APP描述"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSave" :loading="saving">
            保存设置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getSystemSettings, updateSystemSettings, uploadFile } from '@/api';

const form = ref({
  app_name: '',
  app_logo: '',
  app_description: '',
});
const saving = ref(false);

async function loadSettings() {
  try {
    const data = await getSystemSettings();
    form.value = { ...form.value, ...data };
  } catch (e) {
    ElMessage.error('加载失败');
  }
}

function beforeUpload(file) {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    ElMessage.error('只能上传图片!');
    return false;
  }
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!');
    return false;
  }
  return true;
}

async function uploadLogo(options) {
  try {
    const formData = new FormData();
    formData.append('file', options.file);
    const data = await uploadFile('avatar', formData);
    form.value.app_logo = data.url;
    ElMessage.success('上传成功');
  } catch (e) {
    ElMessage.error(e?.message || '上传失败');
  }
}

function handleUpload() {
  document.querySelector('.logo-uploader input')?.click();
}

async function handleSave() {
  if (!form.value.app_name.trim()) {
    ElMessage.warning('请输入APP名称');
    return;
  }
  saving.value = true;
  try {
    await updateSystemSettings({
      app_name: form.value.app_name.trim(),
      app_logo: form.value.app_logo,
      app_description: form.value.app_description.trim(),
    });
    ElMessage.success('保存成功');
  } catch (e) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-page {
  padding: 20px;
}

.setting-card {
  max-width: 700px;
}

.logo-upload {
  display: flex;
  align-items: center;
}

.logo-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #e5e5e5;
}

.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 24px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-placeholder {
  width: 80px;
  height: 80px;
  border: 1px dashed #dcdfe6;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-placeholder:hover {
  border-color: #409eff;
}

.logo-uploader {
  display: inline-block;
}
</style>
