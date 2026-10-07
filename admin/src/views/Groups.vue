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
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
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
    <el-dialog v-model="showCreateDialog" title="创建群" width="400px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="群名称">
          <el-input v-model="createForm.name" placeholder="请输入群名称" />
        </el-form-item>
        <el-form-item label="群主UID">
          <el-input v-model="createForm.ownerUid" placeholder="可选，默认第一个用户" />
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
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getGroupList,
  createGroup as createGroupApi,
  updateGroupStatus,
  setGroupPublic,
  disbandGroup,
} from '@/api';

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
  ownerUid: '',
  isPublic: false,
});

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
      ownerUid: createForm.ownerUid.trim() || undefined,
      isPublic: createForm.isPublic,
    });
    ElMessage.success('创建成功');
    showCreateDialog.value = false;
    createForm.name = '';
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
</style>
