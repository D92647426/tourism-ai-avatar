<script setup lang="ts">
import { onMounted, ref } from "vue";

import { fetchDashboard } from "../../api/admin";

const data = ref<any>({});

onMounted(async () => {
  data.value = await fetchDashboard();
});

function logout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_username");
  window.location.href = "/admin/login";
}
</script>

<template>
  <main class="page admin">
    <nav class="top-nav">
      <strong>管理后台数据大屏</strong>
      <router-link to="/">游客端</router-link>
      <router-link to="/admin/knowledge">知识库</router-link>
      <router-link to="/admin/avatar">数字人配置</router-link>
      <button type="button" @click="logout">退出</button>
    </nav>
    <section class="metric-grid">
      <div class="metric">今日服务人次<strong>{{ data.today_service_count }}</strong></div>
      <div class="metric">平均响应时间<strong>{{ data.avg_latency_ms }}ms</strong></div>
      <div class="metric">满意度<strong>{{ data.satisfaction_score || "暂无" }}</strong></div>
      <div class="metric">知识命中率<strong>{{ Math.round((data.knowledge_hit_rate || 0) * 100) }}%</strong></div>
      <div class="metric">新增评分<strong>{{ data.rating_count || 0 }}</strong></div>
      <div class="metric">负向反馈<strong>{{ data.negative_rating_count || 0 }}</strong></div>
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="section-heading">
          <span>热门问答</span>
          <strong>Top {{ data.hot_questions?.length || 0 }}</strong>
        </div>
        <div v-for="item in data.hot_questions" :key="item.topic" class="bar-row">
          <span>{{ item.topic }}</span>
          <div><i :style="{ width: `${Math.min(item.count, 100)}%` }" /></div>
          <strong>{{ item.count }}</strong>
        </div>
      </div>
      <div class="panel">
        <div class="section-heading">
          <span>热门景点</span>
          <strong>路线访问</strong>
        </div>
        <p v-if="!data.hot_spots?.length">暂无路线访问数据。</p>
        <div v-for="item in data.hot_spots" :key="item.name" class="rank-row">
          <span>{{ item.name }}</span>
          <strong>{{ item.count }}</strong>
        </div>
      </div>
      <div class="panel wide-panel">
        <div class="section-heading">
          <span>景点评分排行</span>
          <strong>游客满意度</strong>
        </div>
        <p v-if="!data.rating_ranking?.length">暂无游客评分。游客端提交后会实时进入这里。</p>
        <div v-for="item in data.rating_ranking" :key="item.spot_id" class="rank-row">
          <span>{{ item.spot_name }}</span>
          <small>综合 {{ item.average_overall || "暂无" }} · 拍照 {{ item.average_photo || "暂无" }} · {{ item.total_ratings }} 条</small>
          <strong>{{ item.weighted_average_overall || item.average_overall || "-" }}</strong>
        </div>
      </div>
      <div class="panel">
        <div class="section-heading">
          <span>路线偏好</span>
          <strong>游客画像</strong>
        </div>
        <div class="preference-grid">
          <div v-for="item in data.route_preferences" :key="item.name">
            <strong>{{ item.value }}</strong>
            <span>{{ item.name }}</span>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="section-heading">
          <span>评分情绪趋势</span>
          <strong>真实评论</strong>
        </div>
        <p v-if="!data.emotion_trend?.length">暂无评论情绪数据。</p>
        <div v-for="item in data.emotion_trend" :key="item.date" class="emotion-row">
          <span>{{ item.date }}</span>
          <b class="positive" :style="{ width: `${Math.min(item.positive * 18, 100)}%` }" />
          <b class="neutral" :style="{ width: `${Math.min(item.neutral * 18, 100)}%` }" />
          <b class="negative" :style="{ width: `${Math.min(item.negative * 18, 100)}%` }" />
        </div>
      </div>
      <div class="panel">
        <div class="section-heading">
          <span>高频游客标签</span>
          <strong>偏好洞察</strong>
        </div>
        <p v-if="!data.top_tags?.length">暂无标签数据。</p>
        <div class="tag-cloud">
          <span v-for="item in data.top_tags" :key="item.tag">{{ item.tag }} · {{ item.count }}</span>
        </div>
      </div>
    </section>
  </main>
</template>
