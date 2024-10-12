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
          <!-- Display the geocoded lat/lng -->
          <p v-if="startLat && startLng">Latitude: {{ startLat }}</p>
          <p v-if="startLat && startLng">Longitude: {{ startLng }}</p>
        </div>
        <!-- Input fields for destination address -->
        <div>
          <label for="destAddress">Destination Address:</label>
          <input type="text" v-model="destAddress" id="destAddress" />
          <!-- Display the geocoded lat/lng -->
          <p v-if="destLat && destLng">Latitude: {{ destLat }}</p>
          <p v-if="destLat && destLng">Longitude: {{ destLng }}</p>
        </div>
        <!-- Submit button -->
        <button @click="submit">Submit</button>
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
    // Removed HelloWorld.vue as per your instructions
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
      apiKey: 'WHOSPkTEgm_qFM-8asn9-PHpB75Pj6JQjYzot2OMNrw', // Replace with your actual HERE API key
    }
  },
  methods: {
    submit() {
      if (
        this.startLat == null ||
        this.startLng == null ||
        this.destLat == null ||
        this.destLng == null
      ) {
        alert(
          'Please enter valid addresses and ensure they are geocoded correctly.',
        )
        return
      }
      // Set the origin and destination
      this.origin = { lat: this.startLat, lng: this.startLng }
      this.destination = { lat: this.destLat, lng: this.destLng }
    },
    geocodeAddress(address, callback) {
      // Use fetch to call the HERE Geocoding API
      const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(
        address,
      )}&apiKey=${this.apiKey}`
      fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.items && data.items.length > 0) {
            const position = data.items[0].position
            callback(position.lat, position.lng)
          } else {
            callback(null, null)
          }
        })
        .catch(error => {
          console.error('Error during geocoding:', error)
          callback(null, null)
        })
    },
  },
  watch: {
    startAddress(newAddress) {
      if (newAddress) {
        this.geocodeAddress(newAddress, (lat, lng) => {
          this.startLat = lat
          this.startLng = lng
        })
      } else {
        this.startLat = null
        this.startLng = null
      }
    },
    destAddress(newAddress) {
      if (newAddress) {
        this.geocodeAddress(newAddress, (lat, lng) => {
          this.destLat = lat
          this.destLng = lng
        })
      } else {
        this.destLat = null
        this.destLng = null
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
  text-align: center;
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
  width: 300px; /* Adjust the width as needed */
  background-color: #f8f9fa;
  padding: 20px;
  overflow-y: auto;
  text-align: left; /* Align labels and inputs to the left */
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
  flex: 1; /* Fills the remaining space */
  display: flex;
}

.main-content > div {
  flex: 1;
}
</style>
