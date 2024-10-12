<template>
  <div id="app-second">
    <div class="container">
      <!-- Sidebar -->
      <div class="sidebar">
        <!-- Sidebar content -->
        <h3>Sidebar</h3>
        <!-- Input fields for starting address -->
        <div>
          <label for="startAddress">Starting Address:</label>
          <input type="text" v-model="startAddress" id="startAddress" />
        </div>
        <!-- Input fields for destination address -->
        <div>
          <label for="destAddress">Destination Address:</label>
          <input type="text" v-model="destAddress" id="destAddress" />
        </div>
        <!-- Transportation Mode Selection -->
        <div>
          <label for="transportMode">Transportation Mode:</label>
          <select v-model="transportMode" id="transportMode">
            <option value="car">Car</option>
            <option value="pedestrian">Pedestrian</option>
            <option value="bicycle">Bicycle</option>
            <option value="truck">Truck</option>
            <option value="scooter">Scooter</option>
            <option value="taxi">Taxi</option>
            <option value="bus">Bus</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
        <!-- Submit button -->
        <button @click="submit">Submit</button>
        <!-- Display the geocoded lat/lng after submission -->
        <div v-if="startLat && startLng">
          <p><strong>Starting Coordinates:</strong></p>
          <p>Latitude: {{ startLat }}</p>
          <p>Longitude: {{ startLng }}</p>
        </div>
        <div v-if="destLat && destLng">
          <p><strong>Destination Coordinates:</strong></p>
          <p>Latitude: {{ destLat }}</p>
          <p>Longitude: {{ destLng }}</p>
        </div>
        <!-- Display the route instructions and summary -->
        <div v-if="routeInstructions">
          <h4>Route Instructions:</h4>
          <p>
            <strong>{{ startAddress }} - {{ destAddress }}</strong>
          </p>
          <ol>
            <li
              v-for="(item, index) in routeInstructions.instructions"
              :key="index"
            >
              {{ item.instruction }} Go for {{ item.distance }} m.
            </li>
          </ol>
          <p>
            <strong>Total distance:</strong>
            {{ routeInstructions.totalDistance }} m.<br />
            <strong>Travel Time:</strong>
            {{ formatDuration(routeInstructions.totalDuration) }}.
          </p>
        </div>
      </div>
      <!-- Main content -->
      <div class="main-content">
        <HereMap
          :center="center"
          :origin="origin"
          :destination="destination"
          :transportMode="transportMode"
          @route-instructions="handleRouteInstructions"
        />
      </div>
    </div>
  </div>
</template>

<script>
import HereMap from './components/HereMap.vue'
export default {
  name: 'app',
  components: {
    HereMap,
  },
  data() {
    return {
      center: {
        lat: 40.73061,
        lng: -73.935242,
      },
      startAddress: '',
      destAddress: '',
      startLat: null,
      startLng: null,
      destLat: null,
      destLng: null,
      origin: null, // Will be set when the user submits
      destination: null, // Will be set when the user submits
      apiKey: 'eGWoAInnodfZ-UvHagn1dedcuFkk3R5ws63jojRh2ZY', // Replace with your actual HERE API key
      routeInstructions: null, // Will store the route instructions and summary
      transportMode: 'car', // Default transportation mode
    }
  },
  methods: {
    async submit() {
      if (!this.startAddress || !this.destAddress) {
        alert('Please enter both starting and destination addresses.')
        return
      }
      try {
        // Geocode both addresses
        const [startPosition, destPosition] = await Promise.all([
          this.geocodeAddress(this.startAddress),
          this.geocodeAddress(this.destAddress),
        ])

        if (!startPosition) {
          alert('Could not geocode the starting address.')
          return
        }
        if (!destPosition) {
          alert('Could not geocode the destination address.')
          return
        }

        // Set the coordinates
        this.startLat = startPosition.lat
        this.startLng = startPosition.lng
        this.destLat = destPosition.lat
        this.destLng = destPosition.lng

        // Set the origin and destination
        this.origin = { lat: this.startLat, lng: this.startLng }
        this.destination = { lat: this.destLat, lng: this.destLng }
      } catch (error) {
        console.error('Error during geocoding:', error)
        alert('An error occurred during geocoding.')
      }
    },
    geocodeAddress(address) {
      // Return a Promise to handle asynchronous operation
      return new Promise((resolve, reject) => {
        const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(
          address,
        )}&apiKey=${this.apiKey}`
        fetch(url)
          .then(response => response.json())
          .then(data => {
            if (data.items && data.items.length > 0) {
              const position = data.items[0].position
              resolve(position)
            } else {
              resolve(null)
            }
          })
          .catch(error => {
            console.error('Error during geocoding:', error)
            reject(error)
          })
      })
    },
    handleRouteInstructions(routeData) {
      this.routeInstructions = routeData
    },
    formatDuration(duration) {
      if (duration < 3600) {
        // Less than 1 hour
        const minutes = Math.floor(duration / 60)
        const seconds = duration % 60
        return `${minutes} minutes ${seconds} seconds`
      } else if (duration < 86400) {
        // Less than 1 day
        const hours = Math.floor(duration / 3600)
        const minutes = Math.floor((duration % 3600) / 60)
        return `${hours} hours ${minutes} minutes`
      } else {
        // 1 day or more
        const days = Math.floor(duration / 86400)
        const hours = Math.floor((duration % 86400) / 3600)
        const minutes = Math.floor((duration % 3600) / 60)
        return `${days} days ${hours} hours ${minutes} minutes`
      }
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
  width: 300px;
  background-color: #f8f9fa;
  padding: 20px;
  overflow-y: auto;
  text-align: left;
}

.sidebar label {
  display: block;
  margin-top: 10px;
}

.sidebar input {
  width: 100%;
  padding: 5px;
  margin-top: 5px;
}

.sidebar button {
  margin-top: 20px;
  padding: 10px 20px;
}

.main-content {
  flex: 1;
  display: flex;
}

.main-content > div {
  flex: 1;
}
</style>
