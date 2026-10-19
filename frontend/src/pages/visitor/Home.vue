<template>
  <main class="home page">
    <nav class="top-nav">
      <strong>LingTour AI · 灵山胜境数字人导游</strong>
      <router-link to="/admin">管理后台</router-link>
    </nav>
    <section class="hero">
      <div>
        <h1>灵灵导游</h1>
        <p>面向灵山胜境的 AI 数字人导览：基于本地景区知识库回答历史文化、路线、拍照点和服务设施问题，并在地图上生成可演示路线。</p>
        <div class="actions">
          <router-link class="primary" to="/guide">进入数字人导览</router-link>
          <router-link to="/map">查看景区地图</router-link>
        </div>
        <div class="hero-facts">
          <span>RAG 知识库</span>
          <span>灵山真实点位</span>
          <span>语音播报与口型动画</span>
        </div>
      </div>
    </section>
  </main>
</template>
