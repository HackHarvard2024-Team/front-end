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
            <h2>Albatros</h2>
            <p>Get home faster.</p>
            <p>Safer. Smarter</p>
          </div>
        </div>
        <h3></h3>

        <!-- Unit Selection -->
        <div>
          <label>Distance Unit:</label><br />
          <input type="radio" id="miles" value="miles" v-model="unit" />
          <label for="miles">Miles</label>
          <input
            type="radio"
            id="kilometers"
            value="kilometers"
            v-model="unit"
          />
          <label for="kilometers">Kilometers</label>
        </div>

        <!-- Input fields for starting address -->
        <div>
          <label for="startAddress">Starting Address:</label>
          <input type="text" v-model="startAddress" id="startAddress" />
          <button @click="setCurrentLocation('start')">
            Use Current Location
          </button>
        </div>
        <!-- Input fields for destination address -->
        <div>
          <label for="destAddress">Destination Address:</label>
          <input type="text" v-model="destAddress" id="destAddress" />
          <button @click="setCurrentLocation('dest')">
            Use Current Location
          </button>
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
          </select>
        </div>

        <!-- Slider for danger level -->
        <div>
          <label for="dangerLevel">Danger Level: {{ dangerLevel }}</label>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            v-model.number="dangerLevel"
            id="dangerLevel"
          />
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
              {{ item.instruction }} Go for {{ formatDistance(item.distance) }}.
            </li>
          </ol>
          <p>
            <strong>Total distance:</strong>
            {{ formatDistance(routeInstructions.totalDistance) }}.<br />
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
          :dangerLevel="dangerLevel"
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
      apiKey: 'x6N7wftxZkM9EGivWdhO5cVWb5chiDzaWFvAx-u3upU', // Replace with your actual HERE API key
      routeInstructions: null, // Will store the route instructions and summary
      transportMode: 'car', // Default transportation mode
      unit: 'miles', // Default unit for distance
      dangerLevel: 0, // Default danger level
      isStartCurrentLocation: false,
      isDestCurrentLocation: false,
    }
  },
  methods: {
    setCurrentLocation(type) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          if (type === 'start') {
            this.startAddress = 'Current Location'
            this.startLat = lat
            this.startLng = lng
            this.isStartCurrentLocation = true
          } else if (type === 'dest') {
            this.destAddress = 'Current Location'
            this.destLat = lat
            this.destLng = lng
            this.isDestCurrentLocation = true
          }
        })
      } else {
        alert('Geolocation is not supported by your browser.')
      }
    },
    async submit() {
      try {
        if (
          this.startAddress === 'Current Location' &&
          this.isStartCurrentLocation
        ) {
          // Current location is already set, use it
          this.origin = { lat: this.startLat, lng: this.startLng }
        } else {
          const startPosition = await this.geocodeAddress(this.startAddress)
          if (!startPosition) {
            alert('Could not geocode the starting address.')
            return
          }
          this.startLat = startPosition.lat
          this.startLng = startPosition.lng
          this.origin = { lat: this.startLat, lng: this.startLng }
        }

        if (
          this.destAddress === 'Current Location' &&
          this.isDestCurrentLocation
        ) {
          // Current location is already set, use it
          this.destination = { lat: this.destLat, lng: this.destLng }
        } else {
          const destPosition = await this.geocodeAddress(this.destAddress)
          if (!destPosition) {
            alert('Could not geocode the destination address.')
            return
          }
          this.destLat = destPosition.lat
          this.destLng = destPosition.lng
          this.destination = { lat: this.destLat, lng: this.destLng }
        }

        // Once the origin and destination are set, trigger the map to calculate the route
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
</style>
