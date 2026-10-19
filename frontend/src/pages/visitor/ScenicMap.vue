<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { createSession, fetchScenicSpots, recommendRoute, type RoutePlan, type ScenicSpot } from "../../api/visitor";
import ScenicMapView from "../../components/ScenicMapView.vue";

const spots = ref<ScenicSpot[]>([]);
const route = ref<RoutePlan | null>(null);
const availableTime = ref(120);
const interest = ref("history");

const routeIds = computed(() => route.value?.spots.map((spot) => spot.id) || []);

onMounted(async () => {
  const session: any = await createSession();
  spots.value = await fetchScenicSpots();
  route.value = await recommendRoute(session.session_uuid, { interest: ["history", "photo"], available_time: availableTime.value });
});

async function refreshRoute() {
  const session: any = await createSession();
  route.value = await recommendRoute(session.session_uuid, { interest: [interest.value], available_time: availableTime.value });
}
</script>

<template>
  <main class="page">
    <nav class="top-nav">
      <strong>景区地图导览 · 灵山胜境</strong>
      <router-link to="/guide">返回数字人</router-link>
      <router-link to="/admin">管理大屏</router-link>
    </nav>
    <section class="map-planner">
      <label>
        兴趣
        <select v-model="interest" @change="refreshRoute">
          <option value="history">历史文化</option>
          <option value="photo">拍照打卡</option>
          <option value="family">亲子互动</option>
          <option value="nature">自然慢行</option>
          <option value="research">研学深度</option>
        </select>
      </label>
      <label>
        时间
        <select v-model.number="availableTime" @change="refreshRoute">
          <option :value="60">1 小时</option>
          <option :value="120">2 小时</option>
          <option :value="180">3 小时</option>
          <option :value="300">5 小时</option>
        </select>
      </label>
      <button type="button" @click="refreshRoute">生成路线</button>
    </section>
    <ScenicMapView :spots="spots" :route-spot-ids="routeIds" />
    <section class="panel route-summary" v-if="route">
      <strong>{{ route.route_name }}</strong>
      <span>预计 {{ route.total_duration }} 分钟</span>
      <p>{{ route.reason }}</p>
    </section>
  </main>
</template>
