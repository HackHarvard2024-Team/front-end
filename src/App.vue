<template>
  <div id="app">
    <HereMap :center="center" />
  </div>
</template>

<script>
import HereMap from './components/HereMap.vue'
export default {
  name: 'app',
  components: {
    HereMap,
    // Remove the HelloWorld.vue
  },
  data() {
    return {
      // we are this as prop to the HereMap component
      center: {
        lat: 40.73061,
        lng: -73.935242,
      },
    }
  },
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
