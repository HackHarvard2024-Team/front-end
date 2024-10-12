<template>
  <div id="map">
    <!-- The HERE Map will render in this div -->
    <div
      id="mapContainer"
      style="height: 600px; width: 100%"
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
  },
  data() {
    return {
      platform: null,
      apikey: 'WHOSPkTEgm_qFM-8asn9-PHpB75Pj6JQjYzot2OMNrw', // Replace with your actual API key
      origin: { lat: 40.73061, lng: -73.935242 }, // Point A
      destination: { lat: 40.741895, lng: -73.989308 }, // Point B
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
  async mounted() {
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

      // Enable the event system and default interactions:
      const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map))
      const ui = H.ui.UI.createDefault(map, defaultLayers)

      // Adjust map viewport on window resize
      window.addEventListener('resize', () => map.getViewPort().resize())

      // Now use the map as required...
      this.calculateRouteFromAtoB(map)

      // Add the polygons to the map
      this.addPolygonsToMap(map)
    },

    calculateRouteFromAtoB(map) {
      const router = this.platform.getRoutingService(null, 8) // Use version 8 of the Routing API

      // Prepare the 'avoid[areas]' parameter
      const avoidAreas = this.constructAvoidAreasParameter()

      const routeRequestParams = {
        routingMode: 'fast',
        transportMode: 'car',
        origin: `${this.origin.lat},${this.origin.lng}`, // Point A
        destination: `${this.destination.lat},${this.destination.lng}`, // Point B
        return: 'polyline,turnByTurnActions,actions,instructions,travelSummary',
        // Add the 'avoid[areas]' parameter
        'avoid[areas]': avoidAreas,
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

      // Combine both polygons, separating them with '!'
      const avoidAreas = [
        formatPolygon(this.polygonCoords1),
        formatPolygon(this.polygonCoords2),
      ].join('|')

      return avoidAreas
    },

    onSuccess(result, map) {
      const route = result.routes[0]

      // Add the route polyline to the map
      this.addRouteShapeToMap(route, map)

      // Optionally, add markers and other route details
      this.addMarkersToMap(route, map)
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
  },
}
</script>

<style scoped>
#map {
  width: 60vw;
  min-width: 360px;
  text-align: center;
  margin: 5% auto;
  background-color: #ccc;
}
</style>
