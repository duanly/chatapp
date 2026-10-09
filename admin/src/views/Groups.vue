<template>
  <el-card>
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索群名称"
        style="width: 300px"
        clearable
        @keyup.enter="loadList"
      />
      <el-button type="primary" @click="loadList">搜索</el-button>
      <el-button type="success" @click="showCreateDialog = true">创建群</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="头像" width="70">
        <template #default="{ row }">
          <el-avatar :src="getAvatar(row.avatar, row.name)" shape="square" :size="36" />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="群名称" />
      <el-table-column prop="owner_uid" label="群主UID" width="220" show-overflow-tooltip />
      <el-table-column prop="member_count" label="成员数" width="100" />
      <el-table-column label="是否公共" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.is_public" type="success">公共群</el-tag>
          <el-tag v-else type="info">私有</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === 1" type="warning">已关门</el-tag>
          <el-tag v-else type="success">开门中</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="400" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" plain @click="openEditDialog(row)">
            编辑
          </el-button>
          <el-button
            size="small"
            :type="row.status === 1 ? 'success' : 'warning'"
            @click="toggleStatus(row)"
          >
            {{ row.status === 1 ? '开门' : '关门' }}
          </el-button>
          <el-button
            size="small"
            :type="row.is_public ? 'info' : 'primary'"
            @click="togglePublic(row)"
          >
            {{ row.is_public ? '取消公共' : '设为公共' }}
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="handleDisband(row)"
          >
            解散
          </el-button>
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

    <!-- 创建群对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建群" width="500px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="群头像">
          <div class="avatar-upload-wrap">
            <el-upload
              class="avatar-uploader"
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :http-request="uploadGroupAvatar"
              accept="image/*"
            >
              <el-avatar v-if="createForm.avatar" :src="createForm.avatar" shape="square" :size="64" />
              <el-button v-else type="primary" plain>上传头像</el-button>
            </el-upload>
            <span style="margin-left: 12px; color: #999; font-size: 12px">建议尺寸 200x200</span>
          </div>
        </el-form-item>
        <el-form-item label="群名称">
          <el-input v-model="createForm.name" placeholder="请输入群名称" />
        </el-form-item>
        <el-form-item label="群主">
          <el-select
            v-model="createForm.ownerUid"
            filterable
            remote
            placeholder="输入昵称搜索公众号用户"
            :remote-method="searchPublicUsers"
            :loading="ownerSearchLoading"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="u in publicUserOptions"
              :key="u.uid"
              :label="u.nickname + ' (' + u.uid + ')'"
              :value="u.uid"
            />
          </el-select>
          <div style="font-size: 12px; color: #999; margin-top: 4px">
            不选则默认系统第一个用户为群主
          </div>
        </el-form-item>
        <el-form-item label="公共群">
          <el-switch v-model="createForm.isPublic" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑群对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑群信息" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="群头像">
          <div class="avatar-upload-wrap">
            <el-upload
              class="avatar-uploader"
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :http-request="uploadEditAvatar"
              accept="image/*"
            >
              <el-avatar v-if="editForm.avatar" :src="editForm.avatar" shape="square" :size="64" />
              <el-button v-else type="primary" plain>上传头像</el-button>
            </el-upload>
            <span style="margin-left: 12px; color: #999; font-size: 12px">建议尺寸 200x200</span>
          </div>
        </el-form-item>
        <el-form-item label="群名称">
          <el-input v-model="editForm.name" placeholder="请输入群名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleEditSave" :loading="editSaving">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getGroupList,
  createGroup as createGroupApi,
  updateGroup as updateGroupApi,
  updateGroupStatus,
  setGroupPublic,
  disbandGroup,
  getUserList,
  uploadFile,
} from '@/api';
import { getAvatar } from '@/utils/avatar';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = reactive({
  name: '',
  avatar: '',
  ownerUid: '',
  isPublic: false,
});

// 公众号用户搜索（群主选择）
const publicUserOptions = ref([]);
const ownerSearchLoading = ref(false);
let searchTimer = null;
async function searchPublicUsers(keyword) {
  if (searchTimer) clearTimeout(searchTimer);
  if (!keyword) {
    publicUserOptions.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    ownerSearchLoading.value = true;
    try {
      const data = await getUserList({ keyword, pageSize: 20, page: 1 });
      publicUserOptions.value = data.list || [];
    } catch (e) {} finally {
      ownerSearchLoading.value = false;
    }
  }, 300);
}

// 群头像上传
function beforeAvatarUpload(file) {
  const isImage = file.type.startsWith('image/');
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isImage) {
    ElMessage.error('只能上传图片!');
    return false;
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!');
    return false;
  }
  return true;
}
async function uploadGroupAvatar(options) {
  try {
    const formData = new FormData();
    formData.append('file', options.file);
    const data = await uploadFile('avatar', formData);
    createForm.avatar = data.url;
    ElMessage.success('上传成功');
  } catch (e) {
    ElMessage.error('上传失败');
  }
}

// 编辑群
const showEditDialog = ref(false);
const editSaving = ref(false);
const editForm = reactive({
  id: null,
  name: '',
  avatar: '',
});

function openEditDialog(row) {
  editForm.id = row.id;
  editForm.name = row.name;
  editForm.avatar = row.avatar || '';
  showEditDialog.value = true;
}

async function uploadEditAvatar(options) {
  try {
    const formData = new FormData();
    formData.append('file', options.file);
    const data = await uploadFile('avatar', formData);
    editForm.avatar = data.url;
    ElMessage.success('上传成功');
  } catch (e) {
    ElMessage.error('上传失败');
  }
}

async function handleEditSave() {
  if (!editForm.name.trim()) {
    ElMessage.warning('请输入群名称');
    return;
  }
  editSaving.value = true;
  try {
    await updateGroupApi(editForm.id, {
      name: editForm.name.trim(),
      avatar: editForm.avatar,
    });
    ElMessage.success('保存成功');
    showEditDialog.value = false;
    loadList();
  } catch (e) {} finally {
    editSaving.value = false;
  }
}

async function loadList() {
  loading.value = true;
  try {
    const res = await getGroupList({
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

async function toggleStatus(row) {
  const newStatus = row.status === 1 ? 0 : 1;
  const action = newStatus === 1 ? '关门' : '开门';
  try {
    await ElMessageBox.confirm(`确定要${action}该群吗？`, '提示', { type: 'warning' });
    await updateGroupStatus(row.id, newStatus);
    ElMessage.success(`${action}成功`);
    loadList();
  } catch (e) {}
}

async function togglePublic(row) {
  const newPublic = !row.is_public;
  const action = newPublic ? '设为公共群' : '取消公共标志';
  try {
    await ElMessageBox.confirm(`确定要${action}吗？`, '提示', { type: 'warning' });
    await setGroupPublic(row.id, newPublic);
    ElMessage.success('操作成功');
    loadList();
  } catch (e) {}
}

async function handleDisband(row) {
  try {
    await ElMessageBox.confirm(
      `确定要解散群「${row.name}」吗？此操作不可恢复！`,
      '警告',
      { type: 'error', confirmButtonText: '确定解散', cancelButtonText: '取消' }
    );
    await disbandGroup(row.id);
    ElMessage.success('群已解散');
    loadList();
  } catch (e) {}
}

async function handleCreate() {
  if (!createForm.name.trim()) {
    ElMessage.warning('请输入群名称');
    return;
  }
  creating.value = true;
  try {
    await createGroupApi({
      name: createForm.name.trim(),
      avatar: createForm.avatar || undefined,
      ownerUid: createForm.ownerUid || undefined,
      isPublic: createForm.isPublic,
    });
    ElMessage.success('创建成功');
    showCreateDialog.value = false;
    createForm.name = '';
    createForm.avatar = '';
    createForm.ownerUid = '';
    createForm.isPublic = false;
    loadList();
  } catch (e) {} finally {
    creating.value = false;
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

.avatar-upload-wrap {
  display: flex;
  align-items: center;
}

.avatar-uploader :deep(.el-upload) {
  cursor: pointer;
}
</style>
