import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { noAuth: true },
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '概览' },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/Users.vue'),
        meta: { title: '用户管理' },
      },
      {
        path: 'groups',
        name: 'Groups',
        component: () => import('@/views/Groups.vue'),
        meta: { title: '群聊管理' },
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('@/views/Messages.vue'),
        meta: { title: '消息记录' },
      },
      {
        path: 'robots',
        name: 'Robots',
        component: () => import('@/views/Robots.vue'),
        meta: { title: '机器人管理' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_PATH || '/'),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token');
  if (to.meta.noAuth) {
    next();
  } else if (!token) {
    next('/login');
  } else {
    next();
  }
});

export default router;
