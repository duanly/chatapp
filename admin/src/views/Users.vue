<template>
  <div>
    <el-card>
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜索 UID/手机号/昵称"
          style="width: 300px"
          clearable
          @keyup.enter="loadList"
        />
        <el-button type="primary" @click="loadList">搜索</el-button>
        <el-button type="success" @click="showCreateDialog = true">创建用户</el-button>
        <el-button @click="showBatchDialog = true">批量创建</el-button>
        <el-button @click="showImportDialog = true">导入TSDD用户</el-button>
      </div>

      <el-table :data="list" v-loading="loading" border stripe>
        <el-table-column label="头像" width="72">
          <template #default="{ row }">
            <el-avatar :size="36" :src="row.avatar || defaultAvatar" style="background: #f0f0f0" />
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="120" show-overflow-tooltip />
        <el-table-column label="UID" width="200">
          <template #default="{ row }">
            <span class="uid-text">{{ maskUid(row.uid) }}</span>
            <el-button
              type="primary"
              link
              size="small"
              @click.stop="copyUid(row.uid)"
              style="margin-left: 6px"
            >复制</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="short_no" label="短号" width="100" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1" type="danger" size="small">已封禁</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="设备锁" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.device_lock" type="warning" size="small">已开启</el-tag>
            <el-tag v-else type="info" size="small">未开启</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 1"
              size="small"
              type="success"
              @click="toggleStatus(row, 0)"
            >解封</el-button>
            <el-button
              v-else
              size="small"
              type="danger"
              @click="toggleStatus(row, 1)"
            >封禁</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        style="margin-top: 20px; justify-content: flex-end"
        background
        layout="total, prev, pager, next"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        @current-change="pageChange"
      />
    </el-card>

    <!-- 用户详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="用户详情" width="560px" top="8vh">
      <div v-loading="detailLoading" class="user-detail">
        <div class="detail-header">
          <el-avatar :size="64" :src="detailUser?.avatar || defaultAvatar" style="background: #f0f0f0" />
          <div class="detail-basic">
            <div class="detail-nickname">{{ detailUser?.nickname || '-' }}</div>
            <div class="detail-sub">
              <span>短号：{{ detailUser?.short_no || '-' }}</span>
              <span v-if="detailUser?.phone" style="margin-left: 12px">手机：{{ detailUser?.phone }}</span>
            </div>
          </div>
        </div>

        <el-divider />

        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="UID">
            <span class="uid-text">{{ maskUid(detailUser?.uid) }}</span>
            <el-button type="primary" link size="small" @click="copyUid(detailUser?.uid)">复制</el-button>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="detailUser?.status === 1" type="danger" size="small">已封禁</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">
            {{ formatTime(detailUser?.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后登录">
            {{ formatTime(detailUser?.last_login_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后登录IP">
            {{ detailUser?.last_login_ip || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="公共账号">
            {{ detailUser?.is_public ? '是' : '否' }}
          </el-descriptions-item>
          <el-descriptions-item label="设备锁" :span="2">
            <div style="display: flex; align-items: center; gap: 12px">
              <el-switch
                v-model="deviceLockValue"
                @change="onDeviceLockChange"
                :loading="deviceLockLoading"
              />
              <span style="font-size: 13px; color: #999">
                {{ deviceLockValue ? '开启后只能在绑定设备登录，关闭即解绑所有设备' : '关闭后任意设备均可登录' }}
              </span>
            </div>
            <div v-if="detailUser?.device_id" style="margin-top: 6px; font-size: 12px; color: #999">
              绑定设备：{{ detailUser.device_id }}
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            <el-input
              v-model="remarkValue"
              placeholder="点击编辑备注"
              size="small"
              @blur="saveRemark"
            />
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>最近 5 次登录</el-divider>

        <el-table :data="detailUser?.loginLogs || []" size="small" border>
          <el-table-column prop="ip" label="IP地址" width="160" />
          <el-table-column prop="ip_location" label="归属地" show-overflow-tooltip />
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="!detailUser?.loginLogs?.length" style="text-align: center; color: #999; padding: 20px 0">
          暂无登录记录
        </div>
      </div>
    </el-dialog>

    <!-- 创建用户 -->
    <el-dialog v-model="showCreateDialog" title="创建用户" width="400px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="手机号">
          <el-input v-model="createForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="createForm.nickname" placeholder="可选，默认用户xxxx" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" placeholder="留空则自动生成强密码" show-password />
        </el-form-item>
        <el-form-item label="公共账号">
          <el-switch v-model="createForm.isPublic" />
        </el-form-item>
      </el-form>
      <div v-if="createdUser" style="padding: 12px; background: #f0f9eb; border-radius: 4px; margin-bottom: 16px">
        <div style="font-weight: 600; color: #67c23a; margin-bottom: 8px">创建成功！</div>
        <div>UID：{{ createdUser.uid }}</div>
        <div>手机号：{{ createdUser.phone }}</div>
        <div>昵称：{{ createdUser.nickname }}</div>
        <div>密码：<span style="font-family: monospace; color: #e6a23c">{{ createdUser.password }}</span></div>
      </div>
      <template #footer>
        <el-button @click="showCreateDialog = false; createdUser.value = null">关闭</el-button>
        <el-button type="primary" @click="doCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 批量创建 -->
    <el-dialog v-model="showBatchDialog" title="批量创建用户" width="600px">
      <el-alert
        type="info"
        :closable="false"
        title="每行一个手机号，也支持 JSON 数组。密码自动生成。"
        style="margin-bottom: 16px"
      />
      <el-input
        v-model="batchData"
        type="textarea"
        :rows="10"
        placeholder="每行一个手机号：&#10;13800138000&#10;13800138001&#10;&#10;或 JSON：&#10;[{&quot;phone&quot;:&quot;13800138000&quot;,&quot;nickname&quot;:&quot;张三&quot;}]"
      />
      <div v-if="batchResult" style="margin-top: 12px">
        <el-alert
          :title="`创建完成：成功 ${batchResult.success.length} 个，失败 ${batchResult.failed.length} 个`"
          :type="batchResult.failed.length ? 'warning' : 'success'"
          :closable="false"
        />
        <el-table v-if="batchResult.success.length" :data="batchResult.success" size="small" style="margin-top: 8px">
          <el-table-column prop="uid" label="UID" width="200" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="nickname" label="昵称" width="120" />
          <el-table-column prop="password" label="密码" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showBatchDialog = false; batchResult.value = null">关闭</el-button>
        <el-button type="primary" @click="doBatchCreate" :loading="batchCreating">批量创建</el-button>
      </template>
    </el-dialog>

    <!-- 导入 TSDD -->
    <el-dialog v-model="showImportDialog" title="导入TSDD用户" width="600px">
      <el-alert
        type="info"
        :closable="false"
        title="将JSON格式的用户数组粘贴到下面，已存在的用户会跳过"
        style="margin-bottom: 16px"
      />
      <el-input
        v-model="importData"
        type="textarea"
        :rows="10"
        placeholder='[{"uid":"xxx","phone":"13800138000","nickname":"张三","avatar":""}]'
      />
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="doImport" :loading="importing">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getUserList, setUserStatus, importTsddUsers, createUser, batchCreateUsers,
  getUserDetail, updateUserRemark, setUserPublic, setUserDeviceLock
} from '@/api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZTBlMGUwIiByeD0iOCIvPjx0ZXh0IHg9IjI0IiB5PSIzMCIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+77iXPC90ZXh0Pjwvc3ZnPg==';

// 详情弹窗
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const detailUser = ref(null);
const deviceLockValue = ref(false);
const deviceLockLoading = ref(false);
const remarkValue = ref('');

const showCreateDialog = ref(false);
const creating = ref(false);
const createdUser = ref(null);
const createForm = reactive({ phone: '', nickname: '', password: '', isPublic: false });

const showBatchDialog = ref(false);
const batchCreating = ref(false);
const batchData = ref('');
const batchResult = ref(null);

const showImportDialog = ref(false);
const importData = ref('');
const importing = ref(false);

// UID 脱敏：前3后4，中间 ***
function maskUid(uid) {
  if (!uid) return '-';
  if (uid.length <= 7) return uid;
  return uid.slice(0, 3) + '***' + uid.slice(-4);
}

// 复制 UID
function copyUid(uid) {
  if (!uid) return;
  navigator.clipboard.writeText(uid).then(() => {
    ElMessage.success('UID 已复制');
  }).catch(() => {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = uid;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    ElMessage.success('UID 已复制');
  });
}

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function loadList() {
  loading.value = true;
  try {
    const res = await getUserList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
    });
    list.value = res.list;
    total.value = res.total;
  } catch (e) {} finally {
    loading.value = false;
  }
}

function pageChange(p) {
  page.value = p;
  loadList();
}

async function openDetail(row) {
  detailDialogVisible.value = true;
  detailLoading.value = true;
  try {
    const data = await getUserDetail(row.uid);
    detailUser.value = data;
    deviceLockValue.value = !!data.device_lock;
    remarkValue.value = data.remark || '';
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    detailLoading.value = false;
  }
}

// 设备锁开关
async function onDeviceLockChange(val) {
  if (!detailUser.value) return;
  deviceLockLoading.value = true;
  try {
    await setUserDeviceLock(detailUser.value.uid, val);
    detailUser.value.device_lock = val;
    if (!val) {
      detailUser.value.device_id = '';
    }
    ElMessage.success(val ? '设备锁已开启' : '设备锁已关闭');
    loadList();
  } catch (e) {
    // 回退开关状态
    deviceLockValue.value = !val;
    ElMessage.error(e.message || '操作失败');
  } finally {
    deviceLockLoading.value = false;
  }
}

// 保存备注
async function saveRemark() {
  if (!detailUser.value) return;
  const newRemark = remarkValue.value.trim();
  if (newRemark === (detailUser.value.remark || '')) return;
  try {
    await updateUserRemark(detailUser.value.uid, newRemark);
    detailUser.value.remark = newRemark;
    ElMessage.success('备注已更新');
    loadList();
  } catch (e) {}
}

async function toggleStatus(row, status) {
  try {
    await ElMessageBox.confirm(
      `确定要${status === 1 ? '封禁' : '解封'}该用户吗？`,
      '提示',
      { type: 'warning' }
    );
    await setUserStatus(row.uid, status);
    ElMessage.success('操作成功');
    loadList();
  } catch (e) {}
}

async function doImport() {
  if (!importData.value.trim()) {
    ElMessage.warning('请输入用户数据');
    return;
  }
  try {
    const users = JSON.parse(importData.value);
    if (!Array.isArray(users)) {
      ElMessage.error('数据格式错误，应为数组');
      return;
    }
    importing.value = true;
    const result = await importTsddUsers(users);
    ElMessage.success(`导入完成，成功 ${result.successCount} 个，跳过 ${result.skipCount} 个`);
    showImportDialog.value = false;
    loadList();
  } catch (e) {
    ElMessage.error('JSON 格式错误');
  } finally {
    importing.value = false;
  }
}

async function doCreate() {
  if (!createForm.phone.trim()) {
    ElMessage.warning('请输入手机号');
    return;
  }
  creating.value = true;
  try {
    const user = await createUser({
      phone: createForm.phone.trim(),
      nickname: createForm.nickname.trim() || undefined,
      password: createForm.password || undefined,
      isPublic: createForm.isPublic,
    });
    createdUser.value = user;
    ElMessage.success('创建成功');
    showCreateDialog.value = false;
    loadList();
  } catch (e) {
    ElMessage.error(e?.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

async function doBatchCreate() {
  if (!batchData.value.trim()) {
    ElMessage.warning('请输入数据');
    return;
  }
  let users = [];
  const text = batchData.value.trim();
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      users = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      ElMessage.error('JSON 格式错误');
      return;
    }
  } else {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    users = lines.map(line => ({ phone: line }));
  }
  if (users.length === 0) {
    ElMessage.warning('没有有效数据');
    return;
  }
  batchCreating.value = true;
  try {
    const result = await batchCreateUsers(users);
    batchResult.value = result;
    ElMessage.success(`创建完成：成功 ${result.success.length} 个`);
    loadList();
  } catch (e) {} finally {
    batchCreating.value = false;
  }
}

onMounted(() => loadList());
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.uid-text {
  font-family: monospace;
  font-size: 13px;
  color: #666;
}

.user-detail {
  padding: 4px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-basic {
  flex: 1;
}

.detail-nickname {
  font-size: 18px;
  font-weight: 600;
  color: #111;
  margin-bottom: 6px;
}

.detail-sub {
  font-size: 13px;
  color: #999;
}
</style>
