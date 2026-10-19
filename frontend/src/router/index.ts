import { createRouter, createWebHistory } from "vue-router";

import AdminDashboard from "../pages/admin/AdminDashboard.vue";
import AdminLogin from "../pages/admin/AdminLogin.vue";
import AvatarManage from "../pages/admin/AvatarManage.vue";
import KnowledgeManage from "../pages/admin/KnowledgeManage.vue";
import ChatGuide from "../pages/visitor/ChatGuide.vue";
import Home from "../pages/visitor/Home.vue";
import ScenicMap from "../pages/visitor/ScenicMap.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/guide", component: ChatGuide },
    { path: "/map", component: ScenicMap },
    { path: "/admin/login", component: AdminLogin },
    { path: "/admin", component: AdminDashboard },
    { path: "/admin/knowledge", component: KnowledgeManage },
    { path: "/admin/avatar", component: AvatarManage }
  ]
});

router.beforeEach((to) => {
  if (to.path.startsWith("/admin") && to.path !== "/admin/login" && !localStorage.getItem("admin_token")) {
    return "/admin/login";
  }
});
