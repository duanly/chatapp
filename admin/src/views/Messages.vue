<template>
  <el-card>
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索消息内容"
        style="width: 250px"
        clearable
      />
      <el-input
        v-model="searchUid"
        placeholder="发送者UID"
        style="width: 200px"
        clearable
      />
      <el-input
        v-model="groupId"
        placeholder="群ID"
        style="width: 120px"
        clearable
      />
      <el-button type="primary" @click="loadList">搜索</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="id" label="消息ID" width="180" show-overflow-tooltip />
      <el-table-column prop="group_id" label="群ID" width="80" />
      <el-table-column prop="from_uid" label="发送者UID" width="200" show-overflow-tooltip />
      <el-table-column prop="from_nickname" label="昵称" width="120" />
      <el-table-column prop="type" label="类型" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.type === 2 ? 'success' : 'primary'">
            {{ row.type === 1 ? '文字' : row.type === 2 ? '图片' : '其他' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
      <el-table-column prop="created_at" label="时间" width="180" />
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
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getMessageList } from '@/api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const searchUid = ref('');
const groupId = ref('');

async function loadList() {
  loading.value = true;
  try {
    const res = await getMessageList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      uid: searchUid.value || undefined,
      groupId: groupId.value || undefined,
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

onMounted(() => loadList());
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
</style>
