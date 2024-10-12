<template>
  <div id="app-second">
    <div class="container">
      <!-- Sidebar -->
      <div class="sidebar">
        <!-- Sidebar content -->
        <h3>Sidebar</h3>
        <p>This is the sidebar content.</p>
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
      </div>
      <!-- Main content -->
      <div class="main-content">
        <HereMap :center="center" :origin="origin" :destination="destination" />
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
