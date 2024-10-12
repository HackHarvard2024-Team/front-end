<template>
  <div id="map">
    <!--In the following div the HERE Map will render-->
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
    center: Object,
    // center object { lat: 40.730610, lng: -73.935242 }
  },
  data() {
    return {
      platform: null,
      apikey: 'WHOSPkTEgm_qFM-8asn9-PHpB75Pj6JQjYzot2OMNrw',
    }
  },
  async mounted() {
    // Initialize the platform object:
    const platform = new window.H.service.Platform({
      apikey: this.apikey,
    })
    this.platform = platform
    this.initializeHereMap()
  },
  methods: {
    initializeHereMap() {
      // rendering map

      const mapContainer = this.$refs.hereMap
      const H = window.H
      // Obtain the default map types from the platform object
      var maptypes = this.platform.createDefaultLayers()

      // Instantiate (and display) a map object:
      var map = new H.Map(mapContainer, maptypes.vector.normal.map, {
        zoom: 10,
        center: this.center,
        // center object { lat: 40.730610, lng: -73.935242 }
      })

      addEventListener('resize', () => map.getViewPort().resize())

      // add behavior control
      new H.mapevents.Behavior(new H.mapevents.MapEvents(map))

      // add UI
      H.ui.UI.createDefault(map, maptypes)
      // End rendering the initial map
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
