<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAvatarStore, type AvatarState } from "../../store/avatar";
import { createWhaleAvatar, type WhaleAvatarController } from "./whaleAvatar3d";

const avatar = useAvatarStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const sceneError = ref("");
const expression = computed(() => ({
  idle: "微笑待机", listening: "倾听中", thinking: "思考中", speaking: "讲解中",
  happy: "很开心", concerned: "关切", error: "暂时离线",
})[avatar.state]);
const statusClass = computed(() => `avatar-stage state-${avatar.state}`);
let controller: WhaleAvatarController | undefined;
let observer: ResizeObserver | undefined;
let frame = 0;
let lastPointerX: number | null = null;

/** REQ-025: 将问答状态逐帧传给 3D 角色，并在离开页面时释放 WebGL 资源。 */
onMounted(() => {
  if (!canvas.value) return;
  try {
    controller = createWhaleAvatar(canvas.value);
    observer = new ResizeObserver(([entry]) => {
      controller?.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas.value);
    const start = performance.now();
    const animate = (now: number) => {
      controller?.update(avatar.state, avatar.mouthOpen, (now - start) / 1000);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  } catch (error) {
    sceneError.value = "当前浏览器无法显示 3D 模型，请开启 WebGL 后重试。";
    console.error("3D avatar initialization failed", error);
  }
});

onUnmounted(() => {
  cancelAnimationFrame(frame);
  observer?.disconnect();
  controller?.dispose();
});

function pointerDown(event: PointerEvent) {
  lastPointerX = event.clientX;
  (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
}

function pointerMove(event: PointerEvent) {
  if (lastPointerX === null) return;
  controller?.rotate((event.clientX - lastPointerX) * 0.012);
  lastPointerX = event.clientX;
}

function pointerUp() { lastPointerX = null; }

function preview(state: AvatarState) {
  if (state === "speaking") {
    avatar.simulateSpeaking("你好，我是灵灵。欢迎来到灵山，让我陪你一起探索这里的风景与故事！");
    return;
  }
  avatar.setState(state);
  avatar.caption = state === "thinking" ? "让我想想，怎样安排这段旅程更合适……" : "您好，我是灵灵，正在为您守候。";
}
</script>

<template>
  <section :class="statusClass" aria-label="AI 3D 数字人导游灵灵">
    <div class="avatar-topline">
      <span class="avatar-concept-tag">3D 概念展示</span>
      <span class="avatar-live-dot">实时交互</span>
    </div>
    <div class="avatar-scene">
      <div class="avatar-glow" />
      <span class="avatar-bubble bubble-one" />
      <span class="avatar-bubble bubble-two" />
      <span class="avatar-bubble bubble-three" />
      <canvas
        ref="canvas"
        class="avatar-canvas"
        role="img"
        aria-label="可拖动旋转的蓝鲸主题 3D 数字人灵灵"
        @pointerdown="pointerDown"
        @pointermove="pointerMove"
        @pointerup="pointerUp"
        @pointercancel="pointerUp"
      />
      <p v-if="sceneError" class="avatar-fallback">{{ sceneError }}</p>
      <div class="voice-ring" />
    </div>
    <div class="avatar-viewbar">
      <span>↔ 拖动旋转</span>
      <button type="button" @click="controller?.resetView()">回到正面</button>
    </div>
    <div class="avatar-info">
      <strong>灵灵</strong>
      <span>{{ expression }}</span>
    </div>
    <p class="avatar-caption">{{ avatar.caption }}</p>
    <div class="avatar-preview-actions" aria-label="预览数字人状态">
      <button type="button" @click="preview('idle')">待机</button>
      <button type="button" @click="preview('thinking')">思考</button>
      <button type="button" @click="preview('speaking')">讲解演示</button>
    </div>
  </section>
</template>
