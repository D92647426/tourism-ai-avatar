<script setup lang="ts">
import { computed, ref } from "vue";

export interface ScenicSpot {
  id: number;
  name: string;
  description: string;
  guide_text?: string;
  map_x: number;
  map_y: number;
  tags?: string[];
  recommended_duration?: number;
}

const props = defineProps<{ spots: ScenicSpot[]; routeSpotIds?: number[] }>();
const selectedId = ref<number | null>(null);

const selectedSpot = computed(() => {
  return props.spots.find((spot) => spot.id === selectedId.value) || props.spots.find((spot) => spot.id === 11) || props.spots[0];
});

const routePoints = computed(() => {
  const ids = props.routeSpotIds && props.routeSpotIds.length > 0 ? props.routeSpotIds : [1, 2, 4, 5, 6, 11, 12, 13];
  return ids
    .map((id) => props.spots.find((spot) => spot.id === id))
    .filter((spot): spot is ScenicSpot => Boolean(spot))
    .map((spot) => `${spot.map_x},${spot.map_y}`)
    .join(" ");
});

function selectSpot(id: number) {
  selectedId.value = id;
}
</script>

<template>
  <section class="map-shell" aria-label="灵山胜境景区地图">
    <div class="map-toolbar">
      <div>
        <strong>灵山胜境导览图</strong>
        <span>中轴线 · 太湖水系 · 核心佛教文化区</span>
      </div>
      <button type="button" @click="selectedId = 11">定位大佛</button>
    </div>

    <div class="realistic-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="terrain" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#dcebd4" />
            <stop offset="55%" stop-color="#cfe3d0" />
            <stop offset="100%" stop-color="#b9d5c0" />
          </linearGradient>
          <linearGradient id="lake" x1="0" x2="1">
            <stop offset="0%" stop-color="#c4e5ee" />
            <stop offset="100%" stop-color="#8fc6d7" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#terrain)" />
        <path d="M0 73 C16 67 25 72 38 65 C52 58 61 62 76 53 C88 46 94 50 100 43 L100 100 L0 100Z" fill="url(#lake)" opacity="0.82" />
        <path d="M0 18 C17 6 34 9 51 17 C69 25 82 17 100 9 L100 0 L0 0Z" fill="#8caf8d" opacity="0.62" />
        <path d="M3 32 C17 24 27 24 41 30 C54 36 69 33 95 21" fill="none" stroke="#98b98f" stroke-width="2.8" opacity="0.45" />
        <path d="M13 82 C24 72 33 64 39 55 C45 47 52 40 56 38 C62 34 67 27 72 22 C77 17 82 16 88 18" fill="none" stroke="#f9f2d8" stroke-width="2.5" stroke-linecap="round" />
        <path d="M43 18 C51 26 56 31 60 38 C65 48 70 52 83 58" fill="none" stroke="#f9f2d8" stroke-width="1.7" stroke-linecap="round" opacity="0.78" />
        <path d="M58 16 C52 23 48 29 44 38 C39 48 32 56 21 74" fill="none" stroke="#f9f2d8" stroke-width="1.4" stroke-linecap="round" opacity="0.6" />
        <polyline v-if="routePoints" :points="routePoints" fill="none" stroke="#d55a3d" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
      </svg>

      <button
        v-for="spot in spots"
        :key="spot.id"
        :class="['map-poi', { active: selectedSpot?.id === spot.id, route: routeSpotIds?.includes(spot.id) }]"
        type="button"
        :style="{ left: `${spot.map_x}%`, top: `${spot.map_y}%` }"
        @click="selectSpot(spot.id)"
      >
        <span class="poi-dot" />
        <span class="poi-label">{{ spot.name }}</span>
      </button>

      <div class="map-legend">
        <span><i class="legend-route" /> 推荐路线</span>
        <span><i class="legend-lake" /> 太湖水系</span>
        <span><i class="legend-axis" /> 朝圣中轴线</span>
      </div>
    </div>

    <aside v-if="selectedSpot" class="spot-detail">
      <div>
        <span>当前景点</span>
        <strong>{{ selectedSpot.name }}</strong>
      </div>
      <p>{{ selectedSpot.description }}</p>
      <p v-if="selectedSpot.guide_text" class="guide-text">{{ selectedSpot.guide_text }}</p>
      <div class="tag-row">
        <span v-for="tag in selectedSpot.tags" :key="tag">{{ tag }}</span>
      </div>
      <small>建议停留 {{ selectedSpot.recommended_duration || 10 }} 分钟</small>
    </aside>
  </section>
</template>
