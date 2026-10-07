<template>
  <el-card>
    <div class="toolbar">
      <el-button type="primary" @click="showCreateDialog = true">创建机器人</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="头像" width="80">
        <template #default="{ row }">
          <el-avatar
            :size="36"
            :src="row.avatar || defaultAvatar"
            style="background: #f0f0f0"
          />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" width="150" />
      <el-table-column prop="api_key" label="API Key" width="280" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag type="info" size="small">{{ row.api_key }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="绑定群">
        <template #default="{ row }">
          <el-tag
            v-for="g in row.groups"
            :key="g.group_id"
            size="small"
            style="margin-right: 4px; margin-bottom: 4px"
            closable
            @close="unbindGroup(row, g.group_id)"
          >
            {{ g.group_name }}
          </el-tag>
          <span v-if="!row.groups?.length" style="color: #999">未绑定</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="440" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" plain @click="openLogDialog(row)">消息监控</el-button>
          <el-button size="small" @click="openBindDialog(row)">绑定群</el-button>
          <el-button size="small" type="success" plain @click="openConfigDialog(row)">配置</el-button>
          <el-button
            size="small"
            :type="row.status === 1 ? 'warning' : 'success'"
            @click="toggleStatus(row)"
          >
            {{ row.status === 1 ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建机器人 -->
    <el-dialog v-model="showCreateDialog" title="创建机器人" width="400px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="机器人名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateRobot" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 绑定群 -->
    <el-dialog v-model="bindDialogVisible" title="绑定群聊" width="400px">
      <el-select
        v-model="selectedGroupId"
        placeholder="选择要绑定的群"
        style="width: 100%"
        filterable
      >
        <el-option
          v-for="g in availableGroups"
          :key="g.id"
          :label="g.name"
          :value="g.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="bindDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doBind" :loading="binding">绑定</el-button>
      </template>
    </el-dialog>

    <!-- 机器人配置 -->
    <el-dialog v-model="configDialogVisible" title="编辑机器人" width="400px">
      <el-form :model="configForm" label-width="90px">
        <el-form-item label="机器人头像">
          <div class="avatar-upload">
            <el-avatar
              :size="64"
              :src="configForm.avatar || defaultAvatar"
              style="background: #f0f0f0"
            />
            <el-upload
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :http-request="handleAvatarUpload"
              accept="image/*"
            >
              <el-button size="small" type="primary" plain style="margin-left: 12px">
                更换头像
              </el-button>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="机器人昵称">
          <el-input v-model="configForm.name" placeholder="机器人昵称" maxlength="20" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConfig" :loading="configSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 消息监控 -->
    <el-dialog v-model="logDialogVisible" title="机器人消息监控" width="900px" top="5vh" @close="stopAutoRefresh">
      <div class="log-toolbar">
        <el-select v-model="logFilter.direction" placeholder="全部方向" style="width: 140px" @change="loadLogs">
          <el-option label="全部消息" value="" />
          <el-option label="收到的消息" value="in" />
          <el-option label="发出的消息" value="out" />
        </el-select>
        <el-select v-model="logFilter.groupId" placeholder="全部群" style="width: 180px" clearable @change="loadLogs">
          <el-option
            v-for="g in currentRobot?.groups || []"
            :key="g.group_id"
            :label="g.group_name"
            :value="g.group_id"
          />
        </el-select>
        <el-button type="primary" plain @click="loadLogs">刷新</el-button>
        <el-switch v-model="autoRefresh" active-text="自动刷新" style="margin-left: 10px" />
        <span class="log-count">共 {{ logTotal }} 条</span>
      </div>

      <div class="log-list" v-loading="logLoading">
        <el-empty v-if="logList.length === 0 && !logLoading" description="暂无消息记录" />
        <div
          v-for="log in logList"
          :key="log.id"
          class="log-item"
          :class="log.direction"
        >
          <div class="log-header">
            <el-tag size="small" :type="log.direction === 'in' ? 'info' : 'success'">
              {{ log.direction === 'in' ? '收到' : '发出' }}
            </el-tag>
            <span class="log-group">{{ log.group_name }}</span>
            <span v-if="log.from_nickname" class="log-from">来自: {{ log.from_nickname }}</span>
            <span class="log-time">{{ formatTime(log.created_at) }}</span>
          </div>
          <div class="log-content" :class="{ withdrawn: log.withdrawn }">
            <template v-if="log.withdrawn">
              <span style="color: #999; font-style: italic;">[消息已撤回]</span>
              <span style="color: #bbb; margin-left: 8px; text-decoration: line-through;">
                {{ log.msg_type === 1 ? log.content : '[图片]' }}
              </span>
            </template>
            <template v-else-if="log.msg_type === 1">{{ log.content }}</template>
            <template v-else-if="log.msg_type === 2">
              <el-image :src="log.content" style="max-width: 200px; max-height: 200px" fit="contain" />
            </template>
            <template v-else>[文件消息]</template>
          </div>
        </div>
      </div>

      <template #footer>
        <el-pagination
          v-if="logTotal > 0"
          background
          layout="prev, pager, next"
          :total="logTotal"
          :page-size="50"
          :current-page="logFilter.page"
          @current-change="(p) => { logFilter.page = p; loadLogs(); }"
          style="justify-content: center"
        />
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getRobotList, createRobot as createRobotApi, updateRobot, bindRobotGroup, unbindRobotGroup,
  getRobotMessageLogs, uploadFile
} from '@/api';
import { getGroupList } from '@/api';

const loading = ref(false);
const list = ref([]);
const groupList = ref([]);

const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = reactive({ name: '' });

const bindDialogVisible = ref(false);
const binding = ref(false);
const currentRobot = ref(null);
const selectedGroupId = ref(null);

// 配置弹窗
const configDialogVisible = ref(false);
const configSaving = ref(false);
const configForm = reactive({
  id: null,
  name: '',
  avatar: '',
});

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZTBlMGUwIiByeD0iMzIiLz48dGV4dCB4PSIzMiIgeT0iNDAiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPu+4lTwvdGV4dD48L3N2Zz4=';

function beforeAvatarUpload(file) {
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isImage) {
    ElMessage.error('只能上传图片文件');
    return false;
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB');
    return false;
  }
  return true;
}

async function handleAvatarUpload({ file }) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const result = await uploadFile('avatar', formData);
    configForm.avatar = result?.url || result;
    ElMessage.success('头像上传成功');
  } catch (e) {
    ElMessage.error('头像上传失败');
  }
}

// 消息监控
const logDialogVisible = ref(false);
const logLoading = ref(false);
const logList = ref([]);
const logTotal = ref(0);
const logFilter = reactive({
  direction: '',
  groupId: null,
  page: 1,
  pageSize: 50,
});
const autoRefresh = ref(true);
let autoRefreshTimer = null;

const availableGroups = computed(() => {
  if (!currentRobot.value) return groupList.value;
  const boundIds = currentRobot.value.groups?.map(g => g.group_id) || [];
  return groupList.value.filter(g => !boundIds.includes(g.id));
});

async function loadList() {
  loading.value = true;
  try {
    list.value = await getRobotList();
  } catch (e) {} finally {
    loading.value = false;
  }
}

async function handleCreateRobot() {
  if (!createForm.name.trim()) {
    ElMessage.warning('请输入机器人名称');
    return;
  }
  creating.value = true;
  try {
    await createRobotApi({ name: createForm.name });
    ElMessage.success('创建成功');
    showCreateDialog.value = false;
    createForm.name = '';
    loadList();
  } catch (e) {} finally {
    creating.value = false;
  }
}

async function toggleStatus(row) {
  const newStatus = row.status === 1 ? 0 : 1;
  try {
    await updateRobot(row.id, { status: newStatus });
    ElMessage.success('操作成功');
    loadList();
  } catch (e) {}
}

function openBindDialog(row) {
  currentRobot.value = row;
  selectedGroupId.value = null;
  bindDialogVisible.value = true;
}

async function doBind() {
  if (!selectedGroupId.value) {
    ElMessage.warning('请选择要绑定的群');
    return;
  }
  binding.value = true;
  try {
    await bindRobotGroup(currentRobot.value.id, selectedGroupId.value);
    ElMessage.success('绑定成功');
    bindDialogVisible.value = false;
    loadList();
  } catch (e) {} finally {
    binding.value = false;
  }
}

async function unbindGroup(row, groupId) {
  try {
    await ElMessageBox.confirm('确定解绑该群吗？', '提示', { type: 'warning' });
    await unbindRobotGroup(row.id, groupId);
    ElMessage.success('解绑成功');
    loadList();
  } catch (e) {}
}

function openConfigDialog(row) {
  configForm.id = row.id;
  configForm.name = row.name || '';
  configForm.avatar = row.avatar || '';
  configDialogVisible.value = true;
}

async function saveConfig() {
  if (!configForm.name.trim()) {
    ElMessage.warning('机器人昵称不能为空');
    return;
  }
  configSaving.value = true;
  try {
    await updateRobot(configForm.id, {
      name: configForm.name,
      avatar: configForm.avatar,
    });
    ElMessage.success('保存成功');
    configDialogVisible.value = false;
    loadList();
  } catch (e) {} finally {
    configSaving.value = false;
  }
}

function openLogDialog(row) {
  currentRobot.value = row;
  logFilter.direction = '';
  logFilter.groupId = null;
  logFilter.page = 1;
  logList.value = [];
  logDialogVisible.value = true;
  loadLogs();
  startAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (!autoRefresh.value) return;
  autoRefreshTimer = setInterval(() => {
    if (logFilter.page === 1) {
      loadLogs();
    }
  }, 3000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

// 监听自动刷新开关
watch(autoRefresh, (val) => {
  if (val && logDialogVisible.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

async function loadLogs() {
  if (!currentRobot.value) return;
  logLoading.value = true;
  try {
    const res = await getRobotMessageLogs({
      robotId: currentRobot.value.id,
      direction: logFilter.direction || undefined,
      groupId: logFilter.groupId || undefined,
      page: logFilter.page,
      pageSize: logFilter.pageSize,
    });
    logList.value = res.list || [];
    logTotal.value = res.total || 0;
  } catch (e) {} finally {
    logLoading.value = false;
  }
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = n => String(n).padStart(2, '0');
  // 直接用本地时间显示（和聊天页面一致）
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

onMounted(() => {
  loadList();
  loadGroups();
});

async function loadGroups() {
  try {
    const res = await getGroupList({ pageSize: 100 });
    groupList.value = res.list || [];
  } catch (e) {}
}
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.avatar-upload {
  display: flex;
  align-items: center;
}

.log-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.log-count {
  margin-left: auto;
  color: #999;
  font-size: 13px;
}

.log-list {
  max-height: 60vh;
  overflow-y: auto;
  padding: 8px 0;
}

.log-item {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f7fa;
  border-left: 3px solid #909399;
}

.log-item.in {
  border-left-color: #409eff;
  background: #ecf5ff;
}

.log-item.out {
  border-left-color: #67c23a;
  background: #f0f9eb;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 13px;
  color: #666;
}

.log-group {
  font-weight: 500;
  color: #333;
}

.log-from {
  color: #909399;
}

.log-time {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.log-content {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  word-break: break-all;
}

.log-item {
  transition: opacity 0.2s;
}

.log-item:has(.log-content.withdrawn) {
  opacity: 0.6;
}
</style>
