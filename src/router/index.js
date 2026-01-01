import { createRouter, createWebHistory } from 'vue-router'
import MapPage from '../MapPage.vue' // Import the new MapPage

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', // Default path
      name: 'map',
      component: MapPage, // Now using MapPage
    },
    {
      path: '/map', // Legacy path
      redirect: '/',
    },
  ],
})

export default router
