<template>
  <div id="welcome-page" class="welcome-container">
    <!-- Main Branding -->
    <div class="branding">
      <img
        src="../assets/albatross.webp"
        class="large-logo"
        alt="Albatross Logo"
      />
      <h1>Albatross</h1>
      <p class="tagline">Get home faster. Safer. Smarter.</p>
    </div>

    <!-- Description of App's Mission -->
    <div class="goals">
      <p>We aim to provide:</p>
      <ul>
        <li>Real-time navigation with crime-aware routing.</li>
        <li>Scalable solutions for growing data demands.</li>
        <li>Secure and fast data retrieval for real-time updates.</li>
      </ul>
    </div>

    <!-- Explore Map Button -->
    <button class="explore-btn" @click="exploreMap">Explore Map</button>
  </div>
</template>

<script>
export default {
  methods: {
    exploreMap() {
      this.$router.push('/map')
    },
  },
}
</script>

<style scoped>
/* Welcome Container: combines background image with overlay and gradient */
.welcome-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  text-align: center;
  position: relative;
  background-image: url('../assets/bg.jpg');
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

/* Add gradient overlay effect */
.welcome-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.5),
    rgba(255, 140, 0, 0.6)
  );
  z-index: 0;
}

.branding {
  margin-bottom: 20px;
  z-index: 1;
}

.large-logo {
  width: 200px;
  margin-bottom: 20px;
}

.branding h1 {
  font-size: 4rem;
  color: #fff;
  text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.4);
}

.tagline {
  font-size: 1.7rem;
  color: #fff;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
}

.goals {
  margin-bottom: 30px;
  z-index: 1;
}

.goals p,
.goals li {
  color: #f9f9f9;
  font-size: 1.3rem;
}

.goals ul {
  list-style: none;
  padding: 0;
}

.explore-btn {
  padding: 20px 40px;
  font-size: 1.5rem;
  background-color: #3498db;
  color: #fff;
  border-radius: 10px;
  transition:
    transform 0.3s ease,
    background-color 0.3s ease;
  z-index: 1;
}

.explore-btn:hover {
  background-color: #2980b9;
  transform: scale(1.05);
}
</style>
