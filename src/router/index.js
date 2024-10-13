import { createRouter, createWebHistory } from 'vue-router'
import WelcomePage from '../components/WelcomePage.vue'
import MapPage from '../MapPage.vue' // Import the new MapPage

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', // Default path
      name: 'welcome',
      component: WelcomePage,
    },
    {
      path: '/map', // Map path
      name: 'map',
      component: MapPage, // Now using MapPage
    },
  ],
})

export default router
