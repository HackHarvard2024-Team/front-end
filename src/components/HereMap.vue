<template>
  <div id="map">
    <!-- Search Bar Overlay -->
    <div class="search-bar">
      <input
        type="text"
        v-model="searchQuery"
        @input="getSuggestions"
        @keydown.down.prevent="focusNextSuggestion"
        @keydown.up.prevent="focusPreviousSuggestion"
        @keydown.enter.prevent="handleEnter"
        placeholder="Search for a place"
      />
      <!-- Display suggestions if available -->
      <ul v-if="suggestions.length" class="suggestions">
        <li
          v-for="(suggestion, index) in suggestions"
          :key="index"
          @click="selectSuggestion(suggestion)"
          :class="{ focused: focusedSuggestionIndex === index }"
        >
          {{ suggestion.address.label }}
        </li>
      </ul>
      <button @click="searchPlace">
        <img src="../assets/search-icon.svg" alt="Search" id="search-icon" />
      </button>
    </div>

    <label class="switch">
      <input type="checkbox" v-model="isDarkMode" @change="toggleMapMode" />
      <span class="slider round"></span>
    </label>

    <!-- My Location Button -->
    <button class="my-location-btn" @click="getMyLocation">
      <img
        class="current-top-icon"
        src="../assets/current.svg"
        alt="Location"
      />
      <!-- <img src="/path/to/location-icon.png" alt="My Location Icon" /> -->
    </button>
    <!-- The HERE Map will render in this div -->
    <div
      id="mapContainer"
      style="height: 100%; width: 100%"
      ref="hereMap"
    ></div>
  </div>
</template>

<script>
export default {
  name: 'HereMap',
  props: {
    dangerLevel: {
      type: Number,
      default: 0, // Slider value for danger level
    },
    center: {
      type: Object,
      default: () => ({ lat: 40.73061, lng: -73.935242 }), // Default center if not provided
    },
    origin: {
      type: Object,
      default: null, // Will be provided by the parent component
    },
    destination: {
      type: Object,
      default: null, // Will be provided by the parent component
    },
    transportMode: {
      type: String,
      default: 'car', // Default transport mode
    },
  },
  data() {
    return {
      currentLocationMarker: null,
      isDarkMode: false,
      platform: null,
      apikey: 'WHOSPkTEgm_qFM-8asn9-PHpB75Pj6JQjYzot2OMNrw', // Replace with your actual API key
      map: null,
      ui: null,
      searchQuery: '',
      searchMarker: null, // Marker for the searched place
      apiPolygons: [], // Add this to store API polygons
      suggestions: [], // Array to store suggestions
      focusedSuggestionIndex: -1, // Index of the focused suggestion
      // Store polygon coordinates
      polygonCoords1: [
        { lat: 40.748817, lng: -73.985428 }, // Near Times Square
        { lat: 40.751776, lng: -73.977272 }, // Near Grand Central Terminal
        { lat: 40.744679, lng: -73.977272 }, // Near Madison Square Park
        { lat: 40.744679, lng: -73.985428 }, // Near Penn Station
      ],
    }
  },
  mounted() {
    // Initialize the platform object:
    this.platform = new window.H.service.Platform({
      apikey: this.apikey,
    })
    this.initializeHereMap()
  },
  methods: {
    // Navigate to the next suggestion
    focusNextSuggestion() {
      if (this.suggestions.length > 0) {
        this.focusedSuggestionIndex =
          (this.focusedSuggestionIndex + 1) % this.suggestions.length
      }
    },

    // Navigate to the previous suggestion
    focusPreviousSuggestion() {
      if (this.suggestions.length > 0) {
        this.focusedSuggestionIndex =
          (this.focusedSuggestionIndex - 1 + this.suggestions.length) %
          this.suggestions.length
      }
    },

    handleEnter() {
      // If a suggestion is focused, select it
      if (this.focusedSuggestionIndex !== -1) {
        this.selectFocusedSuggestion()
      } else {
        // Otherwise, perform a normal search
        this.searchPlace()
      }
    },

    // Select the currently focused suggestion
    selectFocusedSuggestion() {
      if (this.focusedSuggestionIndex !== -1) {
        this.selectSuggestion(this.suggestions[this.focusedSuggestionIndex])
      }
    },
    selectSuggestion(suggestion) {
      this.searchQuery = suggestion.address.label // Update the search bar with the selected suggestion
      this.suggestions = [] // Clear suggestions
      this.searchPlace(suggestion.position) // Perform search using the selected suggestion's position
      this.focusedSuggestionIndex = -1 // Reset the focused suggestion index
    },

    async getSuggestions() {
      if (!this.searchQuery) {
        this.suggestions = []
        return
      }

      const url = `https://autocomplete.search.hereapi.com/v1/autocomplete?q=${encodeURIComponent(this.searchQuery)}&apiKey=${this.apikey}&limit=5`

      try {
        const response = await fetch(url)
        const data = await response.json()
        this.suggestions = data.items // Store suggestions in array
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      }
    },

    async recalculateRouteWithPolygons(map) {
      // This function will recalculate the route once, without recursion
      const router = this.platform.getRoutingService(null, 8) // Use version 8 of the Routing API

      // Prepare the 'avoid[areas]' parameter with the fetched polygons
      const avoidAreas = this.constructAvoidAreasParameter()

      const routeRequestParams = {
        routingMode: 'fast',
        transportMode: this.transportMode, // Use the selected transport mode
        origin: `${this.origin.lat},${this.origin.lng}`, // Use this.origin
        destination: `${this.destination.lat},${this.destination.lng}`, // Use this.destination
        return: 'polyline,turnByTurnActions,actions,instructions,travelSummary',
        'avoid[areas]': avoidAreas, // Avoid areas with polygons
        polylineQuality: 'reduced', // Controls the number of points in the polyline
      }

      router.calculateRoute(
        routeRequestParams,
        result => {
          this.onSuccessRecalculate(result, map) // New method for recalculation success
        },
        this.onError,
      )
    },
    getDangerColor() {
      switch (this.dangerLevel) {
        case 0:
          return { fillColor: 'rgba(0, 255, 0, 0.5)', strokeColor: 'green' } // Safe
        case 1:
          return {
            fillColor: 'rgba(173, 255, 47, 0.5)',
            strokeColor: 'yellowgreen',
          }
        case 2:
          return { fillColor: 'rgba(255, 255, 0, 0.5)', strokeColor: 'yellow' }
        case 3:
          return { fillColor: 'rgba(255, 165, 0, 0.5)', strokeColor: 'orange' }
        case 4:
          return {
            fillColor: 'rgba(255, 69, 0, 0.5)',
            strokeColor: 'orangered',
          }
        case 5:
          return { fillColor: 'rgba(255, 0, 0, 0.5)', strokeColor: 'red' } // Most dangerous
        default:
          return { fillColor: 'rgba(0, 255, 0, 0.5)', strokeColor: 'green' } // Default to safe
      }
    },
    async fetchPolygonsFromPolyline(polyline) {
      try {
        console.log(JSON.stringify({ polyline, dangerLevel: this.dangerLevel }))
        const response = await fetch(
          'https://hackharvard.kimbo-d6c.workers.dev/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ polyline, dangerLevel: this.dangerLevel }),
            // body: JSON.stringify({ polyline }),
          },
        )
        const polygons = await response.json()
        return polygons
      } catch (error) {
        console.error('Error fetching polygons:', error)
        return null
      }
    },

    getMyLocation() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const userPosition = { lat, lng }
          const H = window.H

          // Remove existing location marker if it exists
          if (this.currentLocationMarker) {
            this.currentLocationMarker.setGeometry(userPosition)
          } else {
            // Create a new marker if it doesn't exist
            this.currentLocationMarker = new H.map.Marker(userPosition)
            this.map.addObject(this.currentLocationMarker)
          }

          // Center the map on the searched place
          this.map.getViewModel().setLookAtData({
            position: userPosition,
            zoom: 15, // Adjust or remove zoom if bounds are used
          })
        })
      } else {
        // alert('Geolocation is not supported by your browser.')
      }
    },

    initializeHereMap() {
      const H = window.H
      const mapContainer = this.$refs.hereMap

      // Obtain the default map layers from the platform object
      const defaultLayers = this.platform.createDefaultLayers()
      const style = this.isDarkMode
        ? defaultLayers.raster.normal.mapnight
        : defaultLayers.vector.normal.map

      // Instantiate and display a map object:
      const map = new H.Map(mapContainer, style, {
        zoom: 13,
        center: this.center,
      })

      // Store the map instance
      this.map = map

      // Enable the event system and default interactions:
      new H.mapevents.Behavior(new H.mapevents.MapEvents(map))
      const ui = H.ui.UI.createDefault(map, defaultLayers)
      this.ui = ui

      // Adjust map viewport on window resize
      window.addEventListener('resize', () => map.getViewPort().resize())

      // Add the polygons to the map
      this.addPolygonsToMap(map)

      this.getMyLocation()
    },
    toggleMapMode() {
      const defaultLayers = this.platform.createDefaultLayers()
      const style = this.isDarkMode
        ? defaultLayers.raster.normal.mapnight
        : defaultLayers.vector.normal.map

      // Switch the base layer without disposing the map
      this.map.setBaseLayer(style)
    },

    calculateRouteFromAtoB(map) {
      const router = this.platform.getRoutingService(null, 8) // Use version 8 of the Routing API

      // Prepare the 'avoid[areas]' parameter
      const avoidAreas = this.constructAvoidAreasParameter()

      const routeRequestParams = {
        routingMode: 'fast',
        transportMode: this.transportMode, // Use the selected transport mode
        origin: `${this.origin.lat},${this.origin.lng}`, // Use this.origin
        destination: `${this.destination.lat},${this.destination.lng}`, // Use this.destination
        return: 'polyline,turnByTurnActions,actions,instructions,travelSummary',
        // Add the 'avoid[areas]' parameter
        'avoid[areas]': avoidAreas,
        polylineQuality: 'reduced', // Controls the number of points in the polyline
      }

      router.calculateRoute(
        routeRequestParams,
        result => this.onSuccess(result, map),
        this.onError,
      )
    },

    constructAvoidAreasParameter() {
      // Helper function to convert polygon coordinates to the required format
      const formatPolygon = coords => {
        return (
          'polygon:' +
          coords.map(point => `${point.lat},${point.lng}`).join(';')
        )
      }

      const formatAPIPolygon = coords => {
        return (
          'polygon:' +
          coords.map(point => `${point.lat},${point.lon}`).join(';')
        )
      }

      // Combine both polygons, separating them with '|'
      const avoidAreas = [formatPolygon(this.polygonCoords1)]

      if (this.apiPolygons && this.apiPolygons.length > 0) {
        this.apiPolygons.forEach(apiPolygon => {
          avoidAreas.push(formatAPIPolygon(apiPolygon))
        })
      }
      console.log('Avoid areas:', avoidAreas)
      // Join all the avoid areas with '|'
      return avoidAreas.join('|')
    },

    async onSuccess(result, map) {
      const route = result.routes[0]

      // Clear previous routes and markers, but keep the search marker
      map.removeObjects(
        map
          .getObjects()
          .filter(
            obj =>
              obj !== this.searchMarker && obj !== this.currentLocationMarker,
          ),
      )

      // Add the polygons back to the map
      this.addPolygonsToMap(map)

      // Add the route polyline to the map
      this.addRouteShapeToMap(route, map)

      // Optionally, add markers and other route details
      this.addMarkersToMap(route, map)

      // Extract route instructions and summary
      const routeData = this.extractRouteInstructions(route)
      // Emit the data to the parent component
      this.$emit('route-instructions', routeData)

      // Fetch and add polygons from polyline to avoid crime areas
      const firstPolyline = route.sections[0].polyline
      const polygons = await this.fetchPolygonsFromPolyline(firstPolyline)

      if (polygons) {
        this.apiPolygons = polygons // Store the polygons for future use
        this.addPolygonsToMapFromAPI(polygons, map)

        this.recalculateRouteWithPolygons(map)
      }
    },

    onSuccessRecalculate(result, map) {
      // This is a new success handler for recalculating the route once
      const route = result.routes[0]

      // Clear previous routes and markers, but keep the search marker
      map.removeObjects(
        map
          .getObjects()
          .filter(
            obj =>
              obj !== this.searchMarker && obj !== this.currentLocationMarker,
          ),
      )

      // Add the polygons back to the map
      this.addPolygonsToMap(map)

      this.addPolygonsToMapFromAPI(this.apiPolygons, map)

      // Add the recalculated route polyline to the map
      this.addRouteShapeToMap(route, map)

      // Optionally, add markers and other route details
      this.addMarkersToMap(route, map)

      // Extract route instructions and summary
      const routeData = this.extractRouteInstructions(route)
      // Emit the data to the parent component
      this.$emit('route-instructions', routeData)
    },

    extractRouteInstructions(route) {
      let instructions = []
      let totalDistance = 0
      let totalDuration = 0

      route.sections.forEach(section => {
        totalDistance += section.travelSummary.length
        totalDuration += section.travelSummary.duration

        section.actions.forEach(action => {
          instructions.push({
            instruction: action.instruction,
            distance: action.length ? action.length : 0, // Distance per action if available
          })
        })
      })

      return {
        instructions,
        totalDistance,
        totalDuration,
      }
    },

    onError(error) {
      // alert("Can't reach the remote server or no route found.")
      console.error(error)
    },

    addRouteShapeToMap(route, map) {
      const H = window.H
      route.sections.forEach(section => {
        // Decode the polyline to a LineString
        const linestring = H.geo.LineString.fromFlexiblePolyline(
          section.polyline,
        )

        // Create a polyline to display the route:
        const routeLine = new H.map.Polyline(linestring, {
          style: { strokeColor: 'blue', lineWidth: 5 },
        })

        // Add the route line to the map
        map.addObject(routeLine)

        // Adjust the map view to include the whole route
        map.getViewModel().setLookAtData({ bounds: routeLine.getBoundingBox() })
      })
    },

    addMarkersToMap(route, map) {
      const H = window.H
      route.sections.forEach(section => {
        // Create markers for the start and end points
        const startMarker = new H.map.Marker(section.departure.place.location)
        const endMarker = new H.map.Marker(section.arrival.place.location)
        map.addObjects([startMarker, endMarker])
      })
    },

    addPolygonsToMapFromAPI(polygons, map) {
      const H = window.H
      polygons.forEach(polygon => {
        const linestring = new H.geo.LineString()
        polygon.forEach(point => {
          linestring.pushPoint({ lat: point.lat, lng: point.lon })
        })

        const dangerColor = this.getDangerColor()

        const polygonShape = new H.map.Polygon(linestring, {
          style: {
            fillColor: dangerColor.fillColor, // Orange semi-transparent fill
            strokeColor: dangerColor.strokeColor, // Orange border
            lineWidth: 2,
          },
        })

        // Add the polygon to the map
        map.addObject(polygonShape)
      })
    },

    addPolygonsToMap(map) {
      const H = window.H

      // Create LineStrings from the coordinates
      const linestring1 = new H.geo.LineString()
      this.polygonCoords1.forEach(point => {
        linestring1.pushPoint(point)
      })

      // Create the first polygon
      const polygon1 = new H.map.Polygon(linestring1, {
        style: {
          fillColor: 'rgba(255, 0, 0, 0.5)', // Semi-transparent red
          strokeColor: 'red', // Border color
          lineWidth: 2,
        },
      })

      // Add the polygons to the map
      map.addObjects([polygon1])
    },

    async searchPlace() {
      if (!this.searchQuery) {
        // alert('Please enter a place to search.')
        return
      }
      try {
        const position = await this.geocodeAddress(this.searchQuery)
        console.log('Search result:', position)
        if (!position) {
          // alert('Could not find the place.')
          return
        }

        // Remove previous search marker if any
        if (this.searchMarker) {
          this.map.removeObject(this.searchMarker)
        }

        // Add marker to the map
        const H = window.H
        this.searchMarker = new H.map.Marker(position)
        this.map.addObject(this.searchMarker)

        // Center the map on the searched place
        this.map.getViewModel().setLookAtData({
          position: position,
          zoom: 15, // Adjust or remove zoom if bounds are used
        })
      } catch (error) {
        console.error('Error during search:', error)
        // alert('An error occurred during the search.')
      }
    },

    geocodeAddress(address) {
      // Return a Promise to handle asynchronous operation
      return new Promise((resolve, reject) => {
        const service = this.platform.getSearchService()

        service.geocode(
          { q: address },
          result => {
            if (result.items && result.items.length > 0) {
              const position = result.items[0].position
              resolve(position)
            } else {
              resolve(null)
            }
          },
          error => {
            console.error('Geocoding error:', error)
            reject(error)
          },
        )
      })
    },
  },
  watch: {
    origin(newOrigin) {
      if (newOrigin && this.destination && this.map) {
        this.calculateRouteFromAtoB(this.map)
      }
    },
    destination(newDestination) {
      if (newDestination && this.origin && this.map) {
        this.calculateRouteFromAtoB(this.map)
      }
    },
    transportMode() {
      if (this.origin && this.destination && this.map) {
        this.calculateRouteFromAtoB(this.map)
      }
    },
  },
}
</script>

<style scoped>
#map {
  position: relative;
  width: 100%;
  height: 100vh;
  min-width: 360px;
  text-align: center;
  background-color: #ccc;
}

.search-bar {
  position: absolute;
  top: 10px;
  left: 10%;
  width: 70%;
  display: flex;
  z-index: 1000;
  align-items: center;
  border-radius: 50px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  background-color: white;
}

.search-bar input {
  flex: 1;
  padding: 12px 20px;
  font-size: 16px;
  border: none;
  border-radius: 50px 0 0 50px;
  outline: none;
  box-sizing: border-box;
}

.search-bar button {
  padding: 10px;
  background-color: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0 50px 50px 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-bar button img {
  width: 20px;
  height: 20px;
}

.search-bar input:focus {
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
}

.suggestions {
  list-style-type: none;
  padding: 0;
  margin: 20px;
  background-color: white;
  position: absolute;
  top: 20px;
  width: 80%;
  z-index: 1001;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
  border-radius: 5px;
  text-align: LEFT;
}

.suggestions li {
  padding: 10px;
  cursor: pointer;
}

.suggestions .focused {
  background-color: #d3d3d3;
}

.suggestions li:hover {
  background-color: #f0f0f0;
}

.switch {
  position: absolute;
  top: 10px; /* Aligns it with the search bar */
  right: 10%; /* Places it next to the search bar on the right */
  display: inline-block;
  width: 60px;
  height: 34px;
  z-index: 1000; /* Ensures it's above the map */
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
}

.slider:before {
  position: absolute;
  content: '';
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
}

input:checked + .slider {
  background-color: #2196f3;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.my-location-btn {
  position: absolute;
  top: 7px;
  right: 37px;
  background: white;
  border: none;
  padding: 8px;
  border-radius: 50%;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  z-index: 1000;
}

.my-location-btn img {
  width: 24px;
  height: 24px;
}
</style>
