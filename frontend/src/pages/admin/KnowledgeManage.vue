<script setup lang="ts">
import { onMounted, ref } from "vue";

import {
  archiveKnowledgeDocument,
  deleteKnowledgeDocument,
  fetchKnowledgeDocs,
  fetchKnowledgeHistory,
  fetchKnowledgeVersions,
  publishKnowledgeDocument,
  reindexKnowledgeBase,
  searchKnowledge,
  updateKnowledgeDocument,
  uploadKnowledgeDocument
} from "../../api/admin";

type KnowledgeDoc = {
  id: string;
  title: string;
  file_name: string;
  source: string;
  status: "draft" | "active" | "archived" | "deleted";
  editable: boolean;
  chunk_count: number;
  current_version: number;
  version_count: number;
  history_count: number;
  updated_at: string;
  preview: string;
};

const docs = ref<KnowledgeDoc[]>([]);
const versions = ref<any[]>([]);
const history = ref<any[]>([]);
const selectedDoc = ref<KnowledgeDoc | null>(null);
const selectedFile = ref<File | null>(null);
const statusFilter = ref("all");
const uploadTitle = ref("");
const changeNote = ref("后台上传");
const editorTitle = ref("");
const editorContent = ref("");
const editingId = ref("");
const searchQuery = ref("灵山大佛适合怎么讲解？");
const searchResult = ref<any[]>([]);
const busy = ref(false);
const notice = ref("");

const statusText: Record<string, string> = {
  all: "全部",
  draft: "草稿",
  active: "已发布",
  archived: "已归档",
  deleted: "已删除"
};

async function loadDocs() {
  docs.value = await fetchKnowledgeDocs(statusFilter.value) as KnowledgeDoc[];
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  if (selectedFile.value && !uploadTitle.value) {
    uploadTitle.value = selectedFile.value.name.replace(/\.[^.]+$/, "");
  }
}

async function runWithNotice(action: () => Promise<unknown>, message: string) {
  busy.value = true;
  notice.value = "";
  try {
    await action();
    notice.value = message;
    await loadDocs();
    if (selectedDoc.value) await inspectDoc(selectedDoc.value.id);
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "操作失败";
  } finally {
    busy.value = false;
  }
}

async function uploadDoc() {
  if (!selectedFile.value) {
    notice.value = "请选择要上传的知识文档";
    return;
  }
  await runWithNotice(
    () => uploadKnowledgeDocument(selectedFile.value as File, uploadTitle.value, changeNote.value),
    "上传成功，当前为草稿；发布后才会进入游客端 RAG"
  );
  selectedFile.value = null;
}

async function createTextDoc() {
  if (!editorTitle.value.trim() || !editorContent.value.trim()) {
    notice.value = "请填写资料标题和正文";
    return;
  }
  const file = new File([editorContent.value], `${editorTitle.value.trim()}.md`, { type: "text/markdown" });
  await runWithNotice(() => uploadKnowledgeDocument(file, editorTitle.value, changeNote.value), "文本资料已保存为草稿");
  editingId.value = "";
}

function editDoc(doc: KnowledgeDoc) {
  editingId.value = doc.id;
  editorTitle.value = doc.title;
  editorContent.value = doc.preview || "";
  selectedDoc.value = doc;
}

async function updateDoc() {
  if (!editingId.value) {
    await createTextDoc();
    return;
  }
  await runWithNotice(
    () => updateKnowledgeDocument(editingId.value, { title: editorTitle.value, content: editorContent.value, change_note: changeNote.value }),
    "资料已生成新草稿版本；发布后才会进入游客端 RAG"
  );
}

async function changeStatus(doc: KnowledgeDoc, action: "publish" | "archive" | "delete") {
  const messages = {
    publish: "资料已发布，已重建向量索引",
    archive: "资料已归档，已从游客端 RAG 中移除",
    delete: "资料已软删除，历史仍保留"
  };
  const actions = {
    publish: () => publishKnowledgeDocument(doc.id),
    archive: () => archiveKnowledgeDocument(doc.id),
    delete: () => deleteKnowledgeDocument(doc.id)
  };
  await runWithNotice(actions[action], messages[action]);
}

async function rebuild() {
  await runWithNotice(() => reindexKnowledgeBase(), "已重新构建知识库向量索引");
}

async function runSearch() {
  const data = await searchKnowledge(searchQuery.value) as any;
  searchResult.value = data.chunks || [];
}

async function inspectDoc(documentId: string) {
  const doc = docs.value.find((item) => item.id === documentId);
  if (doc) selectedDoc.value = doc;
  versions.value = await fetchKnowledgeVersions(documentId) as any[];
  history.value = await fetchKnowledgeHistory(documentId) as any[];
}

function logout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_username");
  window.location.href = "/admin/login";
}

onMounted(async () => {
  await loadDocs();
  await runSearch();
});
</script>

<template>
  <main class="page">
    <nav class="top-nav">
      <strong>知识库管理</strong>
      <router-link to="/admin">返回大屏</router-link>
      <router-link to="/guide">游客端验证</router-link>
      <button class="secondary" @click="logout">退出登录</button>
    </nav>

    <section class="knowledge-grid">
      <div class="panel">
        <div class="section-heading">
          <div>
            <strong>上传知识文档</strong>
            <span>上传后为草稿；点击发布后才会进入游客端 RAG。</span>
          </div>
        </div>
        <div class="form-stack">
          <label>资料标题 <input v-model="uploadTitle" placeholder="例如：梵宫讲解词" /></label>
          <label>变更说明 <input v-model="changeNote" placeholder="例如：补充雨天讲解词" /></label>
          <label>选择文件 <input type="file" accept=".md,.txt,.csv,.json,.docx,.xlsx" @change="onFileChange" /></label>
          <button :disabled="busy" @click="uploadDoc">上传为草稿</button>
          <p v-if="selectedFile" class="muted">待上传：{{ selectedFile.name }}</p>
        </div>
      </div>

      <div class="panel">
        <div class="section-heading">
          <div>
            <strong>维护文本资料</strong>
            <span>编辑会创建新版本，并回到草稿状态。</span>
          </div>
        </div>
        <div class="form-stack">
          <label>标题 <input v-model="editorTitle" placeholder="例如：雨天游览 FAQ" /></label>
          <label>正文 <textarea v-model="editorContent" rows="9" placeholder="输入讲解词、常见问答或文史资料正文"></textarea></label>
          <div class="actions-line">
            <button :disabled="busy" @click="updateDoc">{{ editingId ? "生成新版本" : "新增文本草稿" }}</button>
            <button class="secondary" :disabled="busy" @click="editingId = ''; editorTitle = ''; editorContent = ''">清空</button>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <strong>文档版本与发布状态</strong>
          <span>游客端只检索已发布资料。</span>
        </div>
        <div class="actions-line">
          <select v-model="statusFilter" @change="loadDocs">
            <option v-for="(label, key) in statusText" :key="key" :value="key">{{ label }}</option>
          </select>
          <button :disabled="busy" @click="rebuild">重建索引</button>
        </div>
      </div>
      <p v-if="notice" class="notice">{{ notice }}</p>
      <div class="knowledge-table">
        <div class="knowledge-row head">
          <span>资料</span>
          <span>状态</span>
          <span>版本</span>
          <span>操作</span>
        </div>
        <div v-for="doc in docs" :key="doc.id" class="knowledge-row">
          <div>
            <strong>{{ doc.title }}</strong>
            <small>{{ doc.source }}</small>
          </div>
          <span>{{ statusText[doc.status] || doc.status }}</span>
          <span>v{{ doc.current_version }} / {{ doc.version_count }}</span>
          <div class="row-actions">
            <button class="secondary" :disabled="doc.status === 'deleted'" @click="inspectDoc(doc.id)">历史</button>
            <button class="secondary" :disabled="doc.status === 'deleted' || !doc.preview" @click="editDoc(doc)">编辑</button>
            <button :disabled="doc.status === 'active' || doc.status === 'deleted' || busy" @click="changeStatus(doc, 'publish')">发布</button>
            <button class="secondary" :disabled="doc.status !== 'active' || busy" @click="changeStatus(doc, 'archive')">归档</button>
            <button class="danger" :disabled="doc.status === 'deleted' || busy" @click="changeStatus(doc, 'delete')">删除</button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="selectedDoc" class="knowledge-grid">
      <div class="panel">
        <strong>{{ selectedDoc.title }} 版本</strong>
        <div v-for="version in versions" :key="version.id" class="history-row">
          <span>v{{ version.version }} {{ version.is_current ? "当前" : "" }}</span>
          <small>{{ version.created_by }} · {{ version.created_at }}</small>
          <small>{{ version.change_note }}</small>
        </div>
      </div>
      <div class="panel">
        <strong>操作历史</strong>
        <div v-for="item in history" :key="item.id" class="history-row">
          <span>{{ item.action }}</span>
          <small>{{ item.actor }} · {{ item.created_at }}</small>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <strong>检索测试</strong>
          <span>只检索已发布知识和内置资料，草稿不会命中。</span>
        </div>
      </div>
      <div class="search-line">
        <input v-model="searchQuery" placeholder="输入测试问题" @keyup.enter="runSearch" />
        <button @click="runSearch">检索</button>
      </div>
      <ol class="search-results">
        <li v-for="chunk in searchResult" :key="chunk.chunk_id">
          <strong>{{ chunk.title }}</strong>
          <span>{{ chunk.source }} · score {{ chunk.score }}</span>
          <p>{{ chunk.text }}</p>
        </li>
      </ol>
    </section>
  </main>
</template>
