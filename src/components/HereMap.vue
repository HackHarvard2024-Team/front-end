<template>
  <div id="map">
    <!-- Search Bar Overlay -->
    <div class="search-bar">
      <input
        type="text"
        v-model="searchQuery"
        @keyup.enter="searchPlace"
        placeholder="Search for a place"
      />
      <button @click="searchPlace">Search</button>
    </div>
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
      platform: null,
      apikey: 'eGWoAInnodfZ-UvHagn1dedcuFkk3R5ws63jojRh2ZY', // Replace with your actual API key
      map: null,
      ui: null,
      searchQuery: '',
      searchMarker: null, // Marker for the searched place
      // Store polygon coordinates
      polygonCoords1: [
        { lat: 40.748817, lng: -73.985428 }, // Near Times Square
        { lat: 40.751776, lng: -73.977272 }, // Near Grand Central Terminal
        { lat: 40.744679, lng: -73.977272 }, // Near Madison Square Park
      ],
      polygonCoords2: [
        { lat: 40.749817, lng: -73.984428 }, // Slightly offset from the first polygon
        { lat: 40.752776, lng: -73.976272 },
        { lat: 40.745679, lng: -73.976272 },
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
    initializeHereMap() {
      const H = window.H
      const mapContainer = this.$refs.hereMap

      // Obtain the default map layers from the platform object
      const defaultLayers = this.platform.createDefaultLayers()

      // Instantiate and display a map object:
      const map = new H.Map(mapContainer, defaultLayers.vector.normal.map, {
        zoom: 13,
        center: this.center,
      })

      // Store the map instance
      this.map = map

      // Enable the event system and default interactions:
      const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map))
      const ui = H.ui.UI.createDefault(map, defaultLayers)
      this.ui = ui

      // Adjust map viewport on window resize
      window.addEventListener('resize', () => map.getViewPort().resize())

      // Add the polygons to the map
      this.addPolygonsToMap(map)
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

      // Combine both polygons, separating them with '|'
      const avoidAreas = [
        formatPolygon(this.polygonCoords1),
        formatPolygon(this.polygonCoords2),
      ].join('|')

      return avoidAreas
    },

    onSuccess(result, map) {
      const route = result.routes[0]

      // Clear previous routes and markers, but keep the search marker
      map.removeObjects(
        map.getObjects().filter(obj => obj !== this.searchMarker),
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
      alert("Can't reach the remote server or no route found.")
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

    addPolygonsToMap(map) {
      const H = window.H

      // Create LineStrings from the coordinates
      const linestring1 = new H.geo.LineString()
      this.polygonCoords1.forEach(point => {
        linestring1.pushPoint(point)
      })

      const linestring2 = new H.geo.LineString()
      this.polygonCoords2.forEach(point => {
        linestring2.pushPoint(point)
      })

      // Create the first polygon
      const polygon1 = new H.map.Polygon(linestring1, {
        style: {
          fillColor: 'rgba(255, 0, 0, 0.5)', // Semi-transparent red
          strokeColor: 'red', // Border color
          lineWidth: 2,
        },
      })

      // Create the second polygon
      const polygon2 = new H.map.Polygon(linestring2, {
        style: {
          fillColor: 'rgba(0, 255, 0, 0.5)', // Semi-transparent green
          strokeColor: 'green', // Border color
          lineWidth: 2,
        },
      })

      // Add the polygons to the map
      map.addObjects([polygon1, polygon2])
    },

    async searchPlace() {
      if (!this.searchQuery) {
        alert('Please enter a place to search.')
        return
      }
      try {
        const position = await this.geocodeAddress(this.searchQuery)
        console.log('Search result:', position)
        if (!position) {
          alert('Could not find the place.')
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
        alert('An error occurred during the search.')
      }
    },

    geocodeAddress(address) {
      // Return a Promise to handle asynchronous operation
      return new Promise((resolve, reject) => {
        const H = window.H
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
    transportMode(newMode) {
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
  width: 80%;
  display: flex;
  z-index: 1000;
}

.search-bar input {
  flex: 1;
  padding: 8px;
  font-size: 14px;
}

.search-bar button {
  padding: 8px 16px;
  font-size: 14px;
}
</style>
