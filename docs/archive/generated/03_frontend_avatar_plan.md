# 结论

当前前端骨架中的 `DigitalAvatar.vue` 仅用 CSS 模拟了数字人的面部表情，**缺少真实的状态机驱动、语音按钮交互、口型同步逻辑**；管理后台**缺失大屏页面**和地图组件。你需要按 **P0（硬闭环）→ P1（增强）→ P2（完善）** 补全以下模块，实现“语音输入→状态切换→口型播放→后台监控”的完整链路。

---

## P0 任务（必须立即完成，3 天内可交付）

### 1. 数字人状态机组件化 — 新建 `frontend/src/composables/useAvatarState.ts`

**目标**：将 `DigitalAvatar.vue` 中的 `state` 变为可控状态机，支持 `idle → listening → thinking → speaking → idle` 循环，以及异常状态 `error`。

```typescript
// frontend/src/composables/useAvatarState.ts
import { reactive, computed } from 'vue'

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'concerned' | 'error'

interface AvatarStateMachine {
  state: AvatarState
  mouthOpen: number      // 0~1，用于口型动画
  emotion: string        // happy / sad / neutral 等，后续映射表情
  canSpeak: boolean
  transition(to: AvatarState, options?: { emotion?: string; mouthOpen?: number }): void
  reset(): void
}

export function useAvatarState(): AvatarStateMachine {
  const internal = reactive({
    state: 'idle' as AvatarState,
    mouthOpen: 0,
    emotion: 'neutral'
  })

  function transition(to: AvatarState, options?: { emotion?: string; mouthOpen?: number }) {
    // 状态转换合法性校验（可选）
    internal.state = to
    if (options?.emotion) internal.emotion = options.emotion
    if (options?.mouthOpen !== undefined) internal.mouthOpen = options.mouthOpen
    else internal.mouthOpen = to === 'speaking' ? 0.5 : 0
  }

  return {
    ...internal,
    canSpeak: computed(() => internal.state === 'speaking'),
    transition,
    reset() { transition('idle') }
  }
}
```

**使用方式**：在 `ChatGuide.vue` 中引入 `useAvatarState` 替代原来的 `useAvatarStore`。

### 2. 语音按钮（VoiceRecorder.vue）— 新建 `frontend/src/components/VoiceRecorder.vue`

**功能**：调用 `MediaRecorder` 录制用户语音，支持开始/停止/发送；同时将 `avatarState` 切换为 `listening`。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAvatarState } from '../../composables/useAvatarState'

const props = defineProps<{
  sessionUuid: string
}>()
const emit = defineEmits<{
  (e: 'send', audioBlob: Blob): void
}>()

const avatarState = useAvatarState()
const mediaRecorder = ref<MediaRecorder | null>(null)
const isRecording = ref(false)

async function startRecording() {
  avatarState.transition('listening')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' })
    emit('send', blob)
    stream.getTracks().forEach(t => t.stop())
  }
  recorder.start()
  mediaRecorder.value = recorder
  isRecording.value = true
}

function stopRecording() {
  mediaRecorder.value?.stop()
  isRecording.value = false
  avatarState.transition('thinking')
}
</script>

<template>
  <div class="voice-recorder">
    <button 
      :class="['mic-btn', { active: isRecording }]"
      @mousedown="startRecording" 
      @mouseup="stopRecording" 
      @touchstart="startRecording" 
      @touchend="stopRecording"
    >
      <svg v-if="!isRecording">🎤</svg>
      <svg v-else>🔴</svg>
    </button>
  </div>
</template>
```

**集成到 ChatPanel**：在输入框旁放置该组件，收到 `audioBlob` 后调用 `/api/visitor/chat/voice`。

### 3. 口型同步（LipSync 模块）— 新建 `frontend/src/composables/useLipSync.ts`

**原理**：模拟口型时，根据音频的实时 RMS 音量驱动 `mouthOpen`；若后端返回了 `lip_sync` 包（如预计算 rms 时间序列），则用时间序列驱动。

```typescript
// frontend/src/composables/useLipSync.ts
import { ref, watch } from 'vue'
import { useAvatarState } from './useAvatarState'

export function useLipSync(audioUrl: string, avatarState: ReturnType<typeof useAvatarState>) {
  const audioContext = new AudioContext()
  const source = ref<MediaElementAudioSourceNode | null>(null)

  function startSync() {
    const audio = new Audio(audioUrl)
    audio.crossOrigin = 'anonymous'
    const src = audioContext.createMediaElementSource(audio)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    analyser.connect(audioContext.destination)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    function updateMouth() {
      if (audio.paused || audio.ended) return
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      avatarState.mouthOpen = Math.min(1, avg / 128)
      requestAnimationFrame(updateMouth)
    }
    audio.play()
    updateMouth()
    source.value = src
  }

  return { startSync }
}
```

**使用**：在收到后端 `audio_url` 后调用 `startSync()`。

### 4. 管理后台大屏页面 — **必须新建文件**

**文件**：`frontend/src/pages/admin/AnalyticsDashboard.vue`  
**路由**：`/admin/analytics`（在 `router/index.ts` 新增）

**内容**：6 个 ECharts 卡片，数据调用 `GET /api/admin/analytics/overview`（当前返回 mock 数据，后续聚合）。

组件清单：

| 卡片 | 图表类型 | 数据字段（来自 overview） |
|------|---------|------------------------|
| 今日访问量 | 数字 + 趋势 | `today_visitors`, `visitor_trend`（日环比） |
| 热门景点 Top5 | 柱状图 | `top_spots: [{name, count}]` |
| 平均停留时长 | 仪表盘/数字 | `avg_stay_minutes` |
| 情绪分布 | 饼图 | `emotion_distribution: {positive, neutral, negative}` |
| 对话轮次趋势 | 折线图 | `chat_trend: [{date, count}]` |
| 错误率 | 警戒色数字 | `error_rate` |

**实现**：使用 `vue-echarts`，每个卡片写成 `EChartsCard.vue` 通用组件（接收配置和 data）。

**后端**：当前 `analytics_overview` 返回 mock 数据，P0 建议直接使用 `GET /api/admin/analytics/overview` 返回演示数据（已存在），P1 再接入真实聚合。

---

## P1 任务（5 天内完成）

### 5. 地图组件（ScenicMap.vue）— 新建 `frontend/src/components/ScenicMap.vue`

**目标**：在游客端展示景区地图，标出景点位置，支持点击查看详情和生成路线。

**技术选型**：使用 Leaflet（免费、轻量）或百度地图API（需ak）。建议 Leaflet + OpenStreetMap 图块。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{
  spots: Array<{id: number; name: string; map_x: number; map_y: number; description: string}>
}>()

const mapContainer = ref<HTMLDivElement>()

onMounted(() => {
  const map = L.map(mapContainer.value!).setView([31.5, 120.5], 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map)

  // 将景区坐标投影到地图上（假设map_x/map_y是百分比坐标，需转换）
  props.spots.forEach(spot => {
    const lat = 31.5 + (spot.map_y / 100) * 0.1
    const lng = 120.5 + (spot.map_x / 100) * 0.1
    const marker = L.marker([lat, lng]).addTo(map)
    marker.bindPopup(`<b>${spot.name}</b><br>${spot.description}`)
  })
})
</script>

<template>
  <div ref="mapContainer" class="scenic-map"></div>
</template>

<style scoped>
.scenic-map { height: 400px; border-radius: 8px; }
</style>
```

**注意**：需要将 `data/scenic_spots.csv` 中的 `map_x,map_y` 转换为真实经纬度（可通过线性映射或真实坐标）。P1 先用模拟映射。

### 6. 状态机完善：异常处理与超时重置

在 `useAvatarState` 中添加超时兜底：如果 `speaking` 超过 10 秒仍未收到 `idle`，强制重置为 `idle`（避免死锁）。

---

## P2 任务（后续迭代）

- **Live2D 集成**：参照 `pixi-live2d-display` 替换 CSS 动画。
- **流式口型同步**：后端支持 SSE 流式返回，口型数据随 token 推送。
- **地图路线绘制**：调用 `POST /api/visitor/routes/recommend` 后在地图上绘制 polyline。

---

## 接口需求补充（额外字段）

为实现语音按钮和后端实时交互，确保以下接口返回字段完整：

| 接口 | 新增字段（需后端配合） | 说明 |
|------|----------------------|------|
| `POST /api/visitor/chat/voice` | 无变化，需保证 `audio_url` 为后端 TTS 生成的 mp3 路径 | 前端拿到后直接播放 |
| `GET /api/admin/analytics/overview` | `today_visitors`, `top_spots`, `avg_stay_minutes`, `emotion_distribution`, `chat_trend`, `error_rate` | 当前已返回部分mock，需补全 |
| `POST /api/visitor/chat/text` | `lip_sync` 字段应提供预计算的 rms 数组（可选） | 可降级为实时音量分析 |

---

## 下一步可直接执行清单（按顺序）

1. 创建 `useAvatarState.ts` 状态机 composable。
2. 修改 `DigitalAvatar.vue`，导入状态机，去掉 `useAvatarStore`，将 `state` 绑定到模板的 CSS class。
3. 新建 `VoiceRecorder.vue`，集成到 `ChatPanel.vue` 输入框旁（替换原本纯文本发送按钮）。
4. 新建 `useLipSync.ts`，在 `ChatGuide.vue` 中收到 `audio_url` 后调用。
5. 新建 `frontend/src/pages/admin/AnalyticsDashboard.vue`，编写 6 个 ECharts 卡片（先 mock 数据）。
6. 在 `frontend/src/router/index.ts` 添加 `/admin/analytics` 路由。
7. （P1）新建 `ScenicMap.vue`，在游客端 `ChatGuide.vue` 或单独路径展示。
8. 测试完整闭环：点击语音按钮 → 状态变 listening → 松开发送 → 状态变 thinking → 收到回答 → 状态变 speaking + 口型动画 → 播放完变 idle。

以上任务均可在现有 skeleton 上直接插入，无需重写项目结构。
