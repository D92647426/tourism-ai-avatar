<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import { loginAdmin } from "../../api/admin";

const router = useRouter();
const username = ref("admin");
const password = ref("123456");
const notice = ref("");
const busy = ref(false);

async function login() {
  busy.value = true;
  notice.value = "";
  try {
    const data = await loginAdmin(username.value, password.value) as any;
    localStorage.setItem("admin_token", data.token);
    localStorage.setItem("admin_username", data.username);
    await router.push("/admin");
  } catch (error) {
    notice.value = "登录失败，请检查管理员账号或密码";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="page login-page">
    <section class="panel login-panel">
      <strong>管理后台登录</strong>
      <p>知识库发布、版本、上传历史和数字人配置需要管理员权限。</p>
      <label>
        账号
        <input v-model="username" autocomplete="username" />
      </label>
      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" @keyup.enter="login" />
      </label>
      <button :disabled="busy" @click="login">登录</button>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </section>
  </main>
</template>
