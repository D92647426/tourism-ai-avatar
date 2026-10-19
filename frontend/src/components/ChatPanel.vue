<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  messages: Array<{ role: string; content: string }>;
  quickPrompts?: string[];
  busy?: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
  listen: [];
}>();

const draft = ref("");

function submit(message = draft.value) {
  const value = message.trim();
  if (!value) return;
  emit("send", value);
  draft.value = "";
}
</script>

<template>
  <section class="panel chat-panel">
    <div class="chat-header">
      <div>
        <strong>向灵灵提问</strong>
        <span>文本 / 浏览器语音输入 / RAG 知识引用</span>
      </div>
      <button type="button" class="icon-button" title="语音输入" aria-label="语音输入" @click="$emit('listen')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      </button>
    </div>

    <div class="quick-prompts" v-if="quickPrompts?.length">
      <button v-for="prompt in quickPrompts" :key="prompt" type="button" @click="submit(prompt)">
        {{ prompt }}
      </button>
    </div>

    <div class="messages">
      <div v-for="(message, index) in messages" :key="index" :class="['message', message.role]">
        {{ message.content }}
      </div>
    </div>

    <form class="chat-input" @submit.prevent="submit()">
      <input v-model="draft" placeholder="向灵灵提问，例如：我只有两个小时，喜欢历史，怎么逛？" />
      <button :disabled="busy">{{ busy ? "处理中" : "发送" }}</button>
    </form>
  </section>
</template>
