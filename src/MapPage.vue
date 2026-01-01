<template>
  <div id="app-second">
    <div class="container">
      <!-- Sidebar -->
      <div class="sidebar">
        <!-- Sidebar content -->
        <div class="logo-box">
          <img
            src="./assets/albatross.webp"
            alt="Albatros"
            class="albatros-logo"
          />
          <div class="header-text">
            <h2>Albatross</h2>
            <p>Get home faster.</p>
            <p>Safer. Smarter</p>
          </div>
        </div>
        <h3></h3>

        <!-- Unit Selection with Toggle Switch -->
        <div class="toggle-switch">
          <div class="switch-container">
            <div
              :class="[
                'toggle',
                unit === 'miles' ? 'toggle-left' : 'toggle-right',
              ]"
              @click="toggleUnit"
            >
              <div class="toggle-button"></div>
              <span class="left-label">Miles</span>
              <span class="right-label">Kilometers</span>
            </div>
          </div>
        </div>

        <!-- Input fields for starting address -->
        <div class="input-container">
          <div class="floating-label-group">
            <input
              type="text"
              v-model="startAddress"
              id="startAddress"
              required
              placeholder=" "
            />
            <label for="startAddress" class="floating-label"
              >Starting Address</label
            >
          </div>
        </div>

        <!-- Input fields for destination address -->
        <div class="input-container">
          <div class="floating-label-group">
            <input
              type="text"
              v-model="destAddress"
              id="destAddress"
              required
              placeholder=" "
            />
            <label for="destAddress" class="floating-label"
              >Destination Address</label
            >
          </div>
        </div>

        <!-- Transportation Mode Selection -->
        <div class="transport-mode-container">
          <label id="transportation-label">Transportation Mode:</label>
          <div class="transport-buttons">
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'car' }"
                @click="transportMode = 'car'"
              >
                <img
                  src="./assets/car-icon.svg"
                  alt="Car"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Car</span>
            </div>
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'pedestrian' }"
                @click="transportMode = 'pedestrian'"
              >
                <img
                  src="./assets/pedestrian-icon.svg"
                  alt="Pedestrian"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Pedestrian</span>
            </div>
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'bicycle' }"
                @click="transportMode = 'bicycle'"
              >
                <img
                  src="./assets/bicycle-icon.svg"
                  alt="Bicycle"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Bicycle</span>
            </div>
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'truck' }"
                @click="transportMode = 'truck'"
              >
                <img
                  src="./assets/truck-icon.svg"
                  alt="Truck"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Truck</span>
            </div>
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'scooter' }"
                @click="transportMode = 'scooter'"
              >
                <img
                  src="./assets/scooter-icon.svg"
                  alt="Scooter"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Scooter</span>
            </div>
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'taxi' }"
                @click="transportMode = 'taxi'"
              >
                <img
                  src="./assets/taxi-icon.svg"
                  alt="Taxi"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Taxi</span>
            </div>
            <div class="transport-button-wrapper">
              <button
                :class="{ active: transportMode === 'bus' }"
                @click="transportMode = 'bus'"
              >
                <img
                  src="./assets/bus-icon.svg"
                  alt="Bus"
                  class="transport-icon"
                />
              </button>
              <span class="transport-label">Bus</span>
            </div>
          </div>
        </div>

        <!-- Slider for danger level -->
        <div class="slider-container">
          <label for="dangerLevel">Danger Level: {{ dangerLevel }}</label>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            v-model.number="dangerLevel"
            id="dangerLevel"
          />
          <p class="danger-note">Default danger level is 3.</p>
        </div>

        <!-- Submit button -->
        <button @click="submit" id="submit-button">Submit</button>
        <!-- Display the route instructions and summary -->
        <div v-if="routeInstructions" class="route-instructions-container">
          <div class="route-summary">
            <p class="travel-time">
              {{ formatDuration(routeInstructions.totalDuration) }}
            </p>
            <p class="total-distance">
              {{ formatDistance(routeInstructions.totalDistance) }}
            </p>
          </div>
          <div class="instructions">
            <div
              v-for="(item, index) in routeInstructions.instructions"
              :key="index"
              class="instruction-item"
            >
              <div class="instruction">
                <img
                  :src="getArrowIcon(item.instruction)"
                  alt="Arrow Icon"
                  class="arrow-icon"
                />
                <p>{{ item.instruction }}</p>
              </div>
              <hr
                v-if="index !== routeInstructions.instructions.length - 1"
                class="separator"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- Main content -->
      <div class="main-content">
        <HereMap
          :center="center"
          :origin="origin"
          :destination="destination"
          :transportMode="transportMode"
          :dangerLevel="dangerLevel"
          @route-instructions="handleRouteInstructions"
        />
      </div>
    </div>
  </div>
</template>

<script>
import arrowLeft from './assets/arrow-left.svg'
import arrowRight from './assets/arrow-right.svg'
import arrowForward from './assets/arrow-forward.svg'
import HereMap from './components/HereMap.vue'
export default {
  name: 'app',
  components: {
    HereMap,
  },
  data() {
    return {
      center: {
        lat: 42.3601,
        lng: -71.0589,
      },
      startAddress: '',
      destAddress: '',
      transportMode: 'car', // Default transportation mode
      startLat: null,
      startLng: null,
      destLat: null,
      destLng: null,
      origin: null, // Will be set when the user submits
      destination: null, // Will be set when the user submits
      routeInstructions: null, // Will store the route instructions and summary
      unit: 'miles', // Default unit for distance
      dangerLevel: 3, // Default danger level
    }
  },
  methods: {
    getArrowIcon(instruction) {
      if (instruction.toLowerCase().includes('left')) {
        return arrowLeft
      }
      if (instruction.toLowerCase().includes('right')) {
        return arrowRight
      }
      return arrowForward // Default icon
    },
    toggleUnit() {
      this.unit = this.unit === 'miles' ? 'kilometers' : 'miles'
    },
    async submit() {
      try {
        const startPosition = await this.geocodeAddress(this.startAddress)
        if (!startPosition) {
          // alert('Could not geocode the starting address.')
          return
        }
        this.startLat = startPosition.lat
        this.startLng = startPosition.lng
        this.origin = { lat: this.startLat, lng: this.startLng }

        const destPosition = await this.geocodeAddress(this.destAddress)
        if (!destPosition) {
          // alert('Could not geocode the destination address.')
          return
        }
        this.destLat = destPosition.lat
        this.destLng = destPosition.lng
        this.destination = { lat: this.destLat, lng: this.destLng }

        // Once the origin and destination are set, trigger the map to calculate the route
      } catch (error) {
        console.error('Error during geocoding:', error)
        alert('An error occurred during geocoding.')
      }
    },
    async geocodeAddress(address) {
      const url = `/.netlify/functions/here-geocode?q=${encodeURIComponent(
        address,
      )}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`)
      }
      const data = await response.json()
      if (data.items && data.items.length > 0) {
        return data.items[0].position
      }
      return null
    },
    handleRouteInstructions(routeData) {
      this.routeInstructions = routeData
    },
    formatDuration(duration) {
      const pluralize = (value, label) =>
        `${value} ${label}${value !== 1 ? 's' : ''}`

      if (duration < 3600) {
        // Less than 1 hour
        const minutes = Math.floor(duration / 60)
        const seconds = duration % 60
        return `${pluralize(minutes, 'minute')} ${pluralize(seconds, 'second')}`
      } else if (duration < 86400) {
        // Less than 1 day
        const hours = Math.floor(duration / 3600)
        const minutes = Math.floor((duration % 3600) / 60)
        return `${pluralize(hours, 'hour')} ${pluralize(minutes, 'minute')}`
      } else {
        // 1 day or more
        const days = Math.floor(duration / 86400)
        const hours = Math.floor((duration % 86400) / 3600)
        const minutes = Math.floor((duration % 3600) / 60)
        return `${pluralize(days, 'day')} ${pluralize(hours, 'hour')} ${pluralize(minutes, 'minute')}`
      }
    },
    formatDistance(distanceInMeters) {
      let distance
      let unitLabel

      if (this.unit === 'miles') {
        // Convert meters to miles
        distance = distanceInMeters * 0.000621371
        unitLabel = distance === 1 ? 'mile' : 'miles'
      } else {
        // Convert meters to kilometers
        distance = distanceInMeters / 1000
        unitLabel = distance === 1 ? 'kilometer' : 'kilometers'
      }

      // Format the number with commas and two decimal places
      const formattedDistance = distance
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

      return `${formattedDistance} ${unitLabel}`
    },
  },
}
</script>

<style>
#app-second {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 0;
  padding: 0;
  height: 100vh;
}

.container {
  display: flex;
  flex-direction: row;
  height: 100%;
}

.sidebar {
  width: 350px;
  background-color: #f8f9fa;
  padding: 20px;
  overflow-y: auto;
  text-align: left;
}

.sidebar label {
  display: block;
  margin-top: 10px;
}

.sidebar input[type='text'],
.sidebar select {
  width: 100%;
  padding: 5px;
  margin-top: 5px;
}

.sidebar input[type='radio'] {
  margin-top: 10px;
}

.sidebar button {
  background-color: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.sidebar button:hover {
  transform: scale(1.1); /* Slight zoom effect */
}

.main-content {
  flex: 1;
  display: flex;
}

.main-content > div {
  flex: 1;
}

.albatros-logo {
  width: 7rem;
  height: 7rem;
  margin-bottom: 10px;
}

.logo-box h2 {
  font-size: 2rem;
  font-weight: bold;
}

.header-text p {
  font-weight: bold;
  font-size: 1.3rem;
}

.header-text {
  display: flex;
  flex-direction: column;
  margin-left: 20px;
  align-items: flex-start;
}

.logo-box {
  display: flex;
  align-items: center;
}

.switch-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
  margin-bottom: 15px;
}

.toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 168px;
  height: 40px;
  background-color: #2c3e50;
  border-radius: 50px;
  position: relative;
  cursor: pointer;
}

.toggle-button {
  width: 98px;
  height: 40px;
  background-color: #fff;
  border-radius: 50px;
  position: absolute;
  transition: transform 0.3s ease;
  border: 1px solid #2c3e50;
}

.toggle-left .toggle-button {
  transform: translateX(0);
  width: 70px;
}

.toggle-right .toggle-button {
  transform: translateX(70px);
}

.left-label,
.right-label {
  font-size: 1rem;
  color: #fff;
  z-index: 1;
  padding: 0 15px;
}

.toggle-left .left-label {
  color: #000;
}

.toggle-switch {
  margin-top: 20px;
}

.toggle-right .right-label {
  color: #000;
}

.floating-label-group {
  position: relative;
  margin-top: 15px;
}

.floating-label-group input {
  width: 100%;
  padding: 10px 5px;
  border: none;
  border-bottom: 1px solid #ccc;
  background: transparent;
  font-size: 16px;
}

.floating-label-group input:focus {
  outline: none;
  border-bottom: 2px solid #4285f4;
}

.floating-label-group input:focus ~ .floating-label,
.floating-label-group input:not(:placeholder-shown) ~ .floating-label {
  top: -20px;
  font-size: 12px;
  color: #4285f4;
}

.floating-label-group .floating-label {
  position: absolute;
  top: -1px;
  left: 5px;
  font-size: 16px;
  color: #999;
  transition: 0.2s ease all;
}

.input-container {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
}

.input-container .floating-label-group {
  flex: 1;
}
.transport-mode-container {
  margin-top: 15px;
}

.transport-buttons {
  display: flex;
  flex-wrap: wrap; /* Allow wrapping if there are too many buttons */
  gap: 10px;
}

.transport-button-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 80px; /* Adjust width for buttons and labels */
}

.transport-buttons button {
  background-color: transparent;
  border: 2px solid #ccc;
  border-radius: 50%;
  padding: 10px;
  cursor: pointer;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s ease;
}

.transport-buttons button img {
  width: 30px;
  height: 30px;
}

.transport-buttons button.active {
  border-color: gold; /* Highlight active button */
}

.transport-buttons button:hover {
  border-color: #4285f4;
}

.transport-label {
  margin-top: 5px;
  font-size: 12px;
  text-align: center;
  color: #333;
}

div #transportation-label {
  margin-left: 15px;
  margin-bottom: 14px;
  font-weight: 800;
  margin-top: 1.5rem;
}

/* Slider Container to extend the full width */
.slider-container {
  width: 100%;
  margin-top: 20px;
}

.slider-container input[type='range'] {
  width: 100%;
  height: 8px;
  appearance: none;
  -webkit-appearance: none;
  background: #ccc;
  outline: none;
  border-radius: 5px;
  transition: background-color 0.3s ease;
}

.slider-container input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #4285f4;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.slider-container input[type='range']:hover {
  background: #4285f4;
}

.danger-note {
  margin-top: 6px;
  font-size: 12px;
  color: #6c757d;
}

/* Submit button styling */
button#submit-button {
  width: 100%;
  padding: 12px;
  background-color: #4285f4;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
  transition: background-color 0.3s ease;
}

button#submit-button:hover {
  background-color: #2c3e50;
}

.route-instructions-container {
  margin-top: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.route-summary {
  text-align: center;
  margin-bottom: 20px;
}

.travel-time {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.total-distance {
  font-size: 18px;
  font-weight: normal;
  color: #2c3e50;
}

.instructions {
  margin-top: 20px;
}

.instruction-item {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
}

.instruction {
  display: flex;
  align-items: center;
}

.arrow-icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
}

.separator {
  width: 100%;
  height: 1px;
  background-color: #ccc;
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
