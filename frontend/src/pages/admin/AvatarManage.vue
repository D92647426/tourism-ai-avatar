<script setup lang="ts">
import { onMounted, ref } from "vue";

import { fetchActiveAvatar, saveAvatarConfig } from "../../api/admin";

const avatar = ref<any>({});
const notice = ref("");
const saving = ref(false);

onMounted(async () => {
  avatar.value = await fetchActiveAvatar();
});

async function save() {
  saving.value = true;
  notice.value = "";
  try {
    avatar.value = await saveAvatarConfig({
      name: avatar.value.name,
      avatar_style: avatar.value.avatar_style,
      clothes: avatar.value.clothes,
      voice_name: avatar.value.voice_name,
      voice_speed: Number(avatar.value.voice_speed || 1),
      opening_text: avatar.value.opening_text,
      expressions: avatar.value.expressions || []
    });
    notice.value = "数字人配置已保存，游客端刷新后生效。";
  } finally {
    saving.value = false;
  }
}

function logout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_username");
  window.location.href = "/admin/login";
}
</script>

<template>
  <main class="page">
    <nav class="top-nav">
      <strong>数字人形象管理</strong>
      <span class="nav-actions">
        <router-link to="/admin">返回大屏</router-link>
        <button type="button" @click="logout">退出</button>
      </span>
    </nav>
    <section class="panel form-preview">
      <label>名称 <input v-model="avatar.name" /></label>
      <label>风格 <input v-model="avatar.avatar_style" /></label>
      <label>服装 <input v-model="avatar.clothes" /></label>
      <label>音色 <input v-model="avatar.voice_name" /></label>
      <label>语速 <input v-model="avatar.voice_speed" type="number" min="0.5" max="1.8" step="0.1" /></label>
      <label>欢迎语 <textarea v-model="avatar.opening_text" /></label>
      <div class="actions">
        <button type="button" :disabled="saving" @click="save">{{ saving ? "保存中..." : "保存配置" }}</button>
        <span>{{ notice }}</span>
      </div>
    </section>
  </main>
</template>
