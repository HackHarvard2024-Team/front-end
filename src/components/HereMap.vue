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

    <div class="legend-stack">
      <div class="legend">
        <div class="legend-title">Danger Levels</div>
        <div
          v-for="level in legendLevels"
          :key="level.level"
          class="legend-item"
        >
          <span
            class="legend-swatch"
            :style="{ backgroundColor: `rgb(${level.rgb})` }"
          ></span>
          <span>Level {{ level.level }} - {{ level.label }}</span>
        </div>
      </div>
      <div class="legend-tip">
        <div class="legend-tip-item">
          <span class="legend-icon legend-icon-info">i</span>
          <span>Zoom in to click a cluster and see why it is risky</span>
        </div>
        <div class="legend-tip-item">
          <span class="legend-icon legend-icon-filter">3</span>
          <span>Default safety filter starts at level 3.</span>
        </div>
        <div class="legend-tip-item">
          <span class="legend-icon legend-icon-city">B</span>
            <span>Currently operational in Boston. More cities coming soon!</span>
        </div>
        <div class="legend-tip-item">
          <span class="legend-icon legend-icon-warning">!</span>
          <span>
            Some routes may cross a risk zone if no safe alternative exists.
            Try raising the safety filter.
          </span>
        </div>
      </div>
    </div>

    <!-- The HERE Map will render in this div -->
    <div
      id="mapContainer"
      style="height: 100%; width: 100%"
      ref="hereMap"
    ></div>
    <div v-if="isMapLoading" class="map-loading">
      <div class="map-loading-card">
        <span class="map-loading-spinner" aria-hidden="true"></span>
        <span class="map-loading-text">Loading map...</span>
      </div>
    </div>
  </div>
</template>

<script>
const NYC_CRIME_PAGE_SIZE = 1000
const CRIME_POLYGON_RADIUS_METERS = 35
const METERS_PER_DEGREE_LAT = 111320
const BOSTON_VIEW_PADDING_RATIO = 0.15
const BOSTON_DANGER_LEVELS = [
  { level: 1, label: 'Low', rgb: '34,197,94' },
  { level: 2, label: 'Guarded', rgb: '132,204,22' },
  { level: 3, label: 'Elevated', rgb: '234,179,8' },
  { level: 4, label: 'High', rgb: '249,115,22' },
  { level: 5, label: 'Severe', rgb: '239,68,68' },
]

export default {
  name: 'HereMap',
  props: {
    dangerLevel: {
      type: Number,
      default: 0, // Slider value for danger level
    },
    center: {
      type: Object,
      default: () => ({ lat: 42.3601, lng: -71.0589 }), // Boston default center
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
      apikey: null,
      map: null,
      mapEvents: null,
      behavior: null,
      ui: null,
      isMapLoading: true,
      hasMapRendered: false,
      searchQuery: '',
      searchMarker: null, // Marker for the searched place
      apiPolygons: [], // Add this to store API polygons
      crimePolygons: [],
      crimePolygonsLoading: false,
      bostonPolygonObjects: [],
      bostonPolygonsLoading: false,
      bostonRequestId: 0,
      bostonAvoidPolygons: [],
      bostonDetailCache: new Map(),
      originMarker: null,
      destinationMarker: null,
      endpointIcons: {},
      markerDragHandlersReady: false,
      dropHandlersReady: false,
      isMarkerDragActive: false,
      globalDragEndHandler: null,
      activeInfoBubble: null,
      bostonUpdateHandle: null,
      legendLevels: BOSTON_DANGER_LEVELS,
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
  async mounted() {
    await this.fetchHereApiKey()
    if (!this.apikey) {
      console.warn('Missing HERE_API_KEY; HERE map cannot initialize.')
      this.isMapLoading = false
      return
    }
    // Initialize the platform object:
    this.platform = new window.H.service.Platform({
      apikey: this.apikey,
    })
    this.initializeHereMap()
    this.loadCrimePolygons()
  },
  methods: {
    async fetchHereApiKey() {
      try {
        const response = await fetch('/.netlify/functions/here-config')
        if (!response.ok) {
          throw new Error(`HERE config fetch failed: ${response.status}`)
        }
        const data = await response.json()
        this.apikey = data.apiKey || null
      } catch (error) {
        console.error('Error loading HERE API key:', error)
        this.apikey = null
      }
    },
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

      const url = `/.netlify/functions/here-autocomplete?q=${encodeURIComponent(
        this.searchQuery,
      )}&limit=5`

      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Autocomplete failed: ${response.status}`)
        }
        const data = await response.json()
        this.suggestions = Array.isArray(data.items) ? data.items : []
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      }
    },

    async loadCrimePolygons() {
      if (this.crimePolygonsLoading || this.crimePolygons.length > 0) {
        return
      }
      this.crimePolygonsLoading = true
      try {
        const rows = await this.fetchCrimeRows()
        this.crimePolygons = this.buildCrimePolygons(rows)
        if (this.map) {
          this.addCrimePolygonsToMap(this.crimePolygons, this.map)
        }
      } catch (error) {
        console.error('Error loading NYC crime data:', error)
      } finally {
        this.crimePolygonsLoading = false
      }
    },

    async fetchCrimeRows() {
      const response = await fetch(
        `/.netlify/functions/nyc-crime?limit=${NYC_CRIME_PAGE_SIZE}`,
      )
      if (!response.ok) {
        throw new Error(`NYC Open Data fetch failed: ${response.status}`)
      }
      const rows = await response.json()
      return Array.isArray(rows) ? rows : []
    },

    buildCrimePolygons(rows) {
      return rows
        .map(row => {
          const lat = Number(row.latitude ?? row.Latitude ?? row.lat)
          const lng = Number(row.longitude ?? row.Longitude ?? row.lon)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null
          }
          return this.pointToPolygon(lat, lng)
        })
        .filter(Boolean)
    },

    pointToPolygon(lat, lng) {
      const { deltaLat, deltaLng } = this.getLatLngDelta(
        lat,
        CRIME_POLYGON_RADIUS_METERS,
      )
      return [
        { lat: lat - deltaLat, lng: lng - deltaLng },
        { lat: lat - deltaLat, lng: lng + deltaLng },
        { lat: lat + deltaLat, lng: lng + deltaLng },
        { lat: lat + deltaLat, lng: lng - deltaLng },
      ]
    },

    getLatLngDelta(lat, radiusMeters) {
      const latRadians = (lat * Math.PI) / 180
      const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.max(Math.cos(latRadians), 0.01)
      return {
        deltaLat: radiusMeters / METERS_PER_DEGREE_LAT,
        deltaLng: radiusMeters / metersPerDegreeLng,
      }
    },

    addCrimePolygonsToMap(polygons, map) {
      if (!polygons || polygons.length === 0) {
        return
      }
      const H = window.H
      const style = {
        fillColor: 'rgba(220, 38, 38, 0.25)',
        strokeColor: 'rgba(220, 38, 38, 0.6)',
        lineWidth: 1,
      }

      polygons.forEach(points => {
        const polygonGeometry = this.buildPolygonGeometry(points)
        const polygonShape = new H.map.Polygon(polygonGeometry, { style })
        map.addObject(polygonShape)
      })
    },

    async updateBostonPolygonsInView() {
      if (!this.map) {
        return
      }
      const bounds = this.getMapBounds()
      if (!bounds) {
        return
      }
      const expanded = this.expandBounds(bounds, BOSTON_VIEW_PADDING_RATIO)
      if (!expanded) {
        return
      }
      const zoom = this.map?.getZoom?.()
      const threshold = this.getDangerThreshold()
      const requestId = this.bostonRequestId + 1
      this.bostonRequestId = requestId
      this.bostonPolygonsLoading = true

      try {
        const payload = await this.fetchBostonClusters(
          expanded,
          Number.isFinite(zoom) ? zoom : null,
          threshold,
        )
        if (requestId !== this.bostonRequestId) {
          return
        }
        this.bostonDetailContext = payload?.context || null
        const clusters = Array.isArray(payload?.clusters)
          ? payload.clusters
          : []
        this.setBostonAvoidPolygons(clusters)
        this.renderBostonClusters(clusters, payload?.maxCount)
      } catch (error) {
        console.error('Error loading Boston clusters:', error)
      } finally {
        if (requestId === this.bostonRequestId) {
          this.bostonPolygonsLoading = false
        }
      }
    },

    async fetchBostonClusters(bounds, zoom, dangerLevel) {
      const params = new URLSearchParams({
        north: String(bounds.north),
        south: String(bounds.south),
        east: String(bounds.east),
        west: String(bounds.west),
        dangerLevel: String(dangerLevel),
      })
      if (Number.isFinite(zoom)) {
        params.set('zoom', String(zoom))
      }
      const response = await fetch(
        `/.netlify/functions/boston-clusters?${params.toString()}`,
      )
      if (!response.ok) {
        throw new Error(`Boston clusters fetch failed: ${response.status}`)
      }
      return response.json()
    },

    getMapBounds() {
      const screenBounds = this.getScreenBounds()
      if (screenBounds) {
        return screenBounds
      }

      const viewModel = this.map?.getViewModel?.()
      const lookAt = viewModel?.getLookAtData?.()
      const lookAtBounds =
        typeof lookAt?.bounds?.getBoundingBox === 'function'
          ? lookAt.bounds.getBoundingBox()
          : lookAt?.bounds

      const normalizedLookAt = this.normalizeBounds(lookAtBounds)
      if (normalizedLookAt) {
        return normalizedLookAt
      }

      const viewBounds = this.map?.getViewBounds?.()
      const normalizedView = this.normalizeBounds(viewBounds)
      if (normalizedView) {
        return normalizedView
      }

      const viewPortBounds = this.map?.getViewPort?.()?.getBoundingBox?.()
      return this.normalizeBounds(viewPortBounds)
    },

    mergeBounds(boundsA, boundsB) {
      if (!boundsA) {
        return boundsB
      }
      if (!boundsB) {
        return boundsA
      }
      return {
        north: Math.max(boundsA.north, boundsB.north),
        south: Math.min(boundsA.south, boundsB.south),
        east: Math.max(boundsA.east, boundsB.east),
        west: Math.min(boundsA.west, boundsB.west),
      }
    },

    getRouteBounds(route) {
      if (!route?.sections?.length) {
        return null
      }
      const H = window.H
      let merged = null
      route.sections.forEach(section => {
        if (!section?.polyline) {
          return
        }
        const linestring = H.geo.LineString.fromFlexiblePolyline(
          section.polyline,
        )
        const bounds = this.normalizeBounds(linestring.getBoundingBox())
        merged = this.mergeBounds(merged, bounds)
      })
      return merged
    },

    getScreenBounds() {
      if (!this.map?.screenToGeo) {
        return null
      }
      const viewportElement =
        this.map?.getViewPort?.()?.element ?? this.$refs.hereMap
      if (!viewportElement) {
        return null
      }
      const width = viewportElement.clientWidth
      const height = viewportElement.clientHeight
      if (!width || !height) {
        return null
      }

      const topLeft = this.map.screenToGeo(0, 0)
      const topRight = this.map.screenToGeo(width, 0)
      const bottomRight = this.map.screenToGeo(width, height)
      const bottomLeft = this.map.screenToGeo(0, height)

      const points = [topLeft, topRight, bottomRight, bottomLeft].filter(
        point =>
          point && Number.isFinite(point.lat) && Number.isFinite(point.lng),
      )

      if (points.length === 0) {
        return null
      }

      let north = -Infinity
      let south = Infinity
      let west = Infinity
      let east = -Infinity

      points.forEach(point => {
        if (point.lat > north) {
          north = point.lat
        }
        if (point.lat < south) {
          south = point.lat
        }
        if (point.lng < west) {
          west = point.lng
        }
        if (point.lng > east) {
          east = point.lng
        }
      })

      if (
        !Number.isFinite(north) ||
        !Number.isFinite(south) ||
        !Number.isFinite(west) ||
        !Number.isFinite(east)
      ) {
        return null
      }

      return { north, south, west, east }
    },

    expandBounds(bounds, ratio) {
      const normalized = this.normalizeBounds(bounds)
      if (!normalized) {
        return null
      }
      const latSpan = normalized.north - normalized.south
      const lngSpan = normalized.east - normalized.west
      return {
        north: normalized.north + latSpan * ratio,
        south: normalized.south - latSpan * ratio,
        east: normalized.east + lngSpan * ratio,
        west: normalized.west - lngSpan * ratio,
      }
    },

    normalizeBounds(bounds) {
      const north = this.getBoundValue(bounds, [
        'getTop',
        'getNorth',
        'top',
        'north',
      ])
      const south = this.getBoundValue(bounds, [
        'getBottom',
        'getSouth',
        'bottom',
        'south',
      ])
      const west = this.getBoundValue(bounds, [
        'getLeft',
        'getWest',
        'left',
        'west',
      ])
      const east = this.getBoundValue(bounds, [
        'getRight',
        'getEast',
        'right',
        'east',
      ])

      if (
        !Number.isFinite(north) ||
        !Number.isFinite(south) ||
        !Number.isFinite(west) ||
        !Number.isFinite(east)
      ) {
        return null
      }

      return { north, south, west, east }
    },

    getBoundValue(bounds, accessors) {
      for (const accessor of accessors) {
        if (typeof bounds?.[accessor] === 'function') {
          const value = bounds[accessor]()
          if (Number.isFinite(value)) {
            return value
          }
        } else if (Number.isFinite(bounds?.[accessor])) {
          return bounds[accessor]
        }
      }
      return null
    },

    scheduleBostonUpdate() {
      if (this.bostonUpdateHandle) {
        clearTimeout(this.bostonUpdateHandle)
      }
      this.bostonUpdateHandle = setTimeout(() => {
        this.bostonUpdateHandle = null
        this.updateBostonPolygonsInView()
      }, 120)
    },

    getDangerThreshold() {
      if (!Number.isFinite(this.dangerLevel) || this.dangerLevel <= 0) {
        return 1
      }
      return Math.min(5, Math.max(1, this.dangerLevel))
    },

    getDangerLevelConfig(level) {
      return (
        BOSTON_DANGER_LEVELS.find(item => item.level === level) ||
        BOSTON_DANGER_LEVELS[0]
      )
    },

    getDangerStyleForLevel(level, intensity) {
      const config = this.getDangerLevelConfig(level)
      const safeIntensity = Number.isFinite(intensity) ? intensity : 0.4
      const alpha = 0.15 + Math.min(0.6, safeIntensity * 0.55)
      return {
        fillColor: `rgba(${config.rgb}, ${alpha})`,
        strokeColor: `rgb(${config.rgb})`,
      }
    },

    setBostonAvoidPolygons(clusters) {
      if (!Array.isArray(clusters)) {
        this.bostonAvoidPolygons = []
        return
      }
      this.bostonAvoidPolygons = clusters
        .map(cluster => ({
          polygon: cluster?.polygon,
          maxLevel: cluster?.summary?.maxLevel ?? cluster?.maxLevel ?? 1,
          count: cluster?.summary?.total ?? cluster?.count ?? 0,
        }))
        .filter(
          item =>
            Array.isArray(item.polygon) &&
            item.polygon.length >= 3 &&
            Number.isFinite(item.maxLevel),
        )
    },

    enableMapDragging() {
      if (!this.behavior || typeof this.behavior.enable !== 'function') {
        return
      }
      const behaviorFlags = window.H?.mapevents?.Behavior
      if (behaviorFlags?.DRAGGING) {
        this.behavior.enable(behaviorFlags.DRAGGING)
      } else if (behaviorFlags?.PANNING) {
        this.behavior.enable(behaviorFlags.PANNING)
      } else {
        this.behavior.enable()
      }
    },

    setupMarkerDragHandlers() {
      if (this.markerDragHandlersReady || !this.map) {
        return
      }
      const map = this.map
      const H = window.H

      map.addEventListener('dragstart', event => {
        const target = event.target
        const pointer = event.currentPointer
        if (!(target instanceof H.map.Marker)) {
          return
        }
        const data = target.getData?.()
        if (!data?.kind) {
          return
        }
        this.isMarkerDragActive = true
        const screenPos = map.geoToScreen(target.getGeometry())
        target.setData({
          ...data,
          dragOffset: new H.math.Point(
            pointer.viewportX - screenPos.x,
            pointer.viewportY - screenPos.y,
          ),
        })
        this.behavior.disable()
        event.stopPropagation()
      })

      map.addEventListener('drag', event => {
        const target = event.target
        const pointer = event.currentPointer
        if (!(target instanceof H.map.Marker)) {
          return
        }
        const data = target.getData?.()
        if (!data?.dragOffset) {
          return
        }
        const newGeo = map.screenToGeo(
          pointer.viewportX - data.dragOffset.x,
          pointer.viewportY - data.dragOffset.y,
        )
        target.setGeometry(newGeo)
        event.stopPropagation()
      })

      map.addEventListener('dragend', event => {
        const target = event.target
        if (!(target instanceof H.map.Marker)) {
          return
        }
        const data = target.getData?.()
        if (!data?.dragOffset) {
          return
        }
        target.setData({ ...data, dragOffset: null })
        if (this.behavior && typeof this.behavior.enable === 'function') {
          this.behavior.enable()
        }
        this.enableMapDragging()
        this.isMarkerDragActive = false
        const position = target.getGeometry()
        if (position && data.kind) {
          this.emitEndpointUpdate(data.kind, position)
        }
        event.stopPropagation()
      })

      this.markerDragHandlersReady = true
      this.setupGlobalDragEndHandler()
    },

    setupGlobalDragEndHandler() {
      if (this.globalDragEndHandler) {
        return
      }
      this.globalDragEndHandler = () => {
        if (!this.isMarkerDragActive) {
          return
        }
        this.isMarkerDragActive = false
        if (this.behavior && typeof this.behavior.enable === 'function') {
          this.behavior.enable()
        }
        this.enableMapDragging()
      }
      window.addEventListener('mouseup', this.globalDragEndHandler)
      window.addEventListener('touchend', this.globalDragEndHandler)
      window.addEventListener('touchcancel', this.globalDragEndHandler)
    },

    setupDropTargets() {
      if (this.dropHandlersReady || !this.map) {
        return
      }
      const mapContainer = this.$refs.hereMap
      if (!mapContainer) {
        return
      }

      mapContainer.addEventListener('dragover', event => {
        event.preventDefault()
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy'
        }
      })

      mapContainer.addEventListener('drop', event => {
        event.preventDefault()
        const type = event.dataTransfer?.getData('text/plain')
        if (type !== 'origin' && type !== 'destination') {
          return
        }
        const rect = mapContainer.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        this.handlePinDrop(type, { x, y })
      })

      this.dropHandlersReady = true
    },

    getEndpointIcon(type) {
      if (this.endpointIcons[type]) {
        return this.endpointIcons[type]
      }
      const H = window.H
      const color = type === 'origin' ? '#2563eb' : '#dc2626'
      const inner = type === 'origin' ? '#bfdbfe' : '#fecaca'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 24 32">
        <path d="M12 0C7.58 0 4 3.58 4 8c0 5.33 6.7 12.5 7.16 12.99L12 22l.84-1.01C13.3 20.5 20 13.33 20 8c0-4.42-3.58-8-8-8z" fill="${color}"/>
        <circle cx="12" cy="8.5" r="4" fill="${inner}"/>
      </svg>`
      const icon = new H.map.Icon(svg)
      this.endpointIcons[type] = icon
      return icon
    },

    setEndpointMarker(type, position, shouldEmit = false) {
      if (!this.map) {
        return null
      }
      const markerKey = type === 'origin' ? 'originMarker' : 'destinationMarker'
      const currentMarker = this[markerKey]
      const hasPosition =
        position &&
        Number.isFinite(position.lat) &&
        Number.isFinite(position.lng)

      if (!hasPosition) {
        if (currentMarker) {
          this.map.removeObject(currentMarker)
          this[markerKey] = null
        }
        return null
      }

      const point = { lat: position.lat, lng: position.lng }
      if (!currentMarker) {
        const marker = new window.H.map.Marker(point, {
          icon: this.getEndpointIcon(type),
        })
        marker.setData({ kind: type })
        marker.draggable = true
        this.map.addObject(marker)
        this[markerKey] = marker
        if (shouldEmit) {
          this.emitEndpointUpdate(type, point)
        }
        return marker
      } else {
        currentMarker.setGeometry(point)
        if (!currentMarker.getParent?.()) {
          this.map.addObject(currentMarker)
        }
        if (shouldEmit) {
          this.emitEndpointUpdate(type, point)
        }
        return currentMarker
      }
    },

    emitEndpointUpdate(type, position) {
      const payload = { lat: position.lat, lng: position.lng }
      if (type === 'origin') {
        this.$emit('origin-updated', payload)
      } else if (type === 'destination') {
        this.$emit('destination-updated', payload)
      }
    },

    handlePinDrop(type, screenPoint) {
      if (!this.map || !screenPoint) {
        return
      }
      const dropGeo = this.map.screenToGeo(screenPoint.x, screenPoint.y)
      if (
        !dropGeo ||
        !Number.isFinite(dropGeo.lat) ||
        !Number.isFinite(dropGeo.lng)
      ) {
        return
      }

      const startScreenY = Math.max(0, screenPoint.y - 70)
      const startGeo = this.map.screenToGeo(screenPoint.x, startScreenY)
      const startPoint =
        startGeo && Number.isFinite(startGeo.lat) && Number.isFinite(startGeo.lng)
          ? { lat: startGeo.lat, lng: startGeo.lng }
          : { lat: dropGeo.lat, lng: dropGeo.lng }

      const marker = this.setEndpointMarker(type, startPoint, false)
      if (!marker) {
        return
      }
      this.animateMarkerDrop(marker, startPoint, {
        lat: dropGeo.lat,
        lng: dropGeo.lng,
      }, () => {
        this.emitEndpointUpdate(type, { lat: dropGeo.lat, lng: dropGeo.lng })
      })
    },

    animateMarkerDrop(marker, from, to, onComplete) {
      if (!marker || !from || !to) {
        return
      }
      if (marker.__animFrame) {
        cancelAnimationFrame(marker.__animFrame)
      }
      const duration = 320
      const startTime = performance.now()
      const easeOut = t => 1 - Math.pow(1 - t, 3)
      const step = now => {
        const progress = Math.min(1, (now - startTime) / duration)
        const eased = easeOut(progress)
        const lat = from.lat + (to.lat - from.lat) * eased
        const lng = from.lng + (to.lng - from.lng) * eased
        marker.setGeometry({ lat, lng })
        if (progress < 1) {
          marker.__animFrame = requestAnimationFrame(step)
        } else {
          marker.__animFrame = null
          marker.setGeometry({ lat: to.lat, lng: to.lng })
          if (typeof onComplete === 'function') {
            onComplete()
          }
        }
      }
      marker.__animFrame = requestAnimationFrame(step)
    },

    activatePin(type) {
      if (!this.map) {
        return
      }
      const fallback = this.map.getCenter?.()
      const current = type === 'origin' ? this.origin : this.destination
      const position = current || fallback
      if (!position) {
        return
      }
      this.setEndpointMarker(type, position, true)
      this.map.getViewModel()?.setLookAtData?.({
        position,
      })
    },

    normalizePolygonCoords(coords, latKey, lngKey) {
      if (!Array.isArray(coords)) {
        return []
      }
      return coords
        .map(point => ({
          lat: Number(point?.[latKey]),
          lng: Number(point?.[lngKey]),
        }))
        .filter(
          point => Number.isFinite(point.lat) && Number.isFinite(point.lng),
        )
    },

    sanitizePolygonPoints(points, maxPoints) {
      if (!Array.isArray(points)) {
        return []
      }
      const filtered = points.filter(
        point => Number.isFinite(point?.lat) && Number.isFinite(point?.lng),
      )
      if (filtered.length < 3) {
        return []
      }

      const deduped = []
      filtered.forEach(point => {
        const last = deduped[deduped.length - 1]
        if (!last || last.lat !== point.lat || last.lng !== point.lng) {
          deduped.push(point)
        }
      })

      if (deduped.length > 1) {
        const first = deduped[0]
        const last = deduped[deduped.length - 1]
        if (first.lat === last.lat && first.lng === last.lng) {
          deduped.pop()
        }
      }

      if (deduped.length < 3) {
        return []
      }

      const maxAllowed = Number.isFinite(maxPoints) ? maxPoints : 16
      if (deduped.length <= maxAllowed) {
        return deduped
      }

      const step = deduped.length / maxAllowed
      const sampled = []
      for (let i = 0; i < maxAllowed; i += 1) {
        sampled.push(deduped[Math.floor(i * step)])
      }

      const normalized = []
      sampled.forEach(point => {
        const last = normalized[normalized.length - 1]
        if (!last || last.lat !== point.lat || last.lng !== point.lng) {
          normalized.push(point)
        }
      })

      if (normalized.length > 1) {
        const first = normalized[0]
        const last = normalized[normalized.length - 1]
        if (first.lat === last.lat && first.lng === last.lng) {
          normalized.pop()
        }
      }

      return normalized.length >= 3 ? normalized : []
    },

    clearMapForRoute(map) {
      if (!map) {
        return
      }
      const keep = new Set(this.bostonPolygonObjects)
      if (this.searchMarker) {
        keep.add(this.searchMarker)
      }
      if (this.originMarker) {
        keep.add(this.originMarker)
      }
      if (this.destinationMarker) {
        keep.add(this.destinationMarker)
      }
      const toRemove = map.getObjects().filter(obj => !keep.has(obj))
      if (toRemove.length > 0) {
        map.removeObjects(toRemove)
      }
    },

    renderBostonClusters(clusters, maxCountOverride) {
      const map = this.map
      if (!map) {
        return
      }
      if (this.bostonPolygonObjects.length > 0) {
        map.removeObjects(this.bostonPolygonObjects)
        this.bostonPolygonObjects = []
      }
      if (!clusters || clusters.length === 0) {
        return
      }

      const H = window.H
      const maxCount =
        Number.isFinite(maxCountOverride) && maxCountOverride > 0
          ? maxCountOverride
          : Math.max(
              1,
              ...clusters.map(cluster =>
                Number.isFinite(cluster?.summary?.total)
                  ? cluster.summary.total
                  : cluster?.count || 1,
              ),
            )
      clusters.forEach((cluster, index) => {
        const summary = cluster?.summary
        if (!summary) {
          return
        }
        const totalCount = Number.isFinite(summary.total)
          ? summary.total
          : cluster?.count || 1
        const intensity = Math.min(1, totalCount / maxCount)
        const clusterLevel = summary.maxLevel || cluster?.maxLevel || 1
        const style = {
          ...this.getDangerStyleForLevel(clusterLevel, intensity),
          lineWidth: 1,
        }
        const polygonPoints = cluster?.polygon
        if (!polygonPoints || polygonPoints.length < 3) {
          return
        }
        const polygonGeometry = this.buildPolygonGeometry(polygonPoints)
        const polygonShape = new H.map.Polygon(polygonGeometry, { style })
        polygonShape.setData({
          summary,
          centroid: cluster?.centroid,
          level: clusterLevel,
          detailKey: cluster?.detailKey || '',
          detailIndex: index,
        })
        this.bostonPolygonObjects.push(polygonShape)
      })

      map.addObjects(this.bostonPolygonObjects)
    },

    handleBostonClusterTap(event) {
      if (!this.ui) {
        return
      }
      const target = event?.target
      const data = target?.getData?.()
      if (!data?.summary) {
        return
      }

      const H = window.H
      const centroid = data.centroid
      const position =
        centroid &&
        Number.isFinite(centroid.lat) &&
        Number.isFinite(centroid.lng)
          ? new H.geo.Point(centroid.lat, centroid.lng)
          : target?.getGeometry?.()?.getBoundingBox?.()?.getCenter?.()

      if (!position) {
        return
      }

      const needsDetails = !this.hasClusterDetails(data.summary)
      const content = this.buildClusterInfoHtml(data.summary, needsDetails)
      if (this.activeInfoBubble) {
        this.ui.removeBubble(this.activeInfoBubble)
      }
      const bubble = new H.ui.InfoBubble(position, { content })
      this.ui.addBubble(bubble)
      this.tweakInfoBubbleLayout(bubble)
      this.activeInfoBubble = bubble

      if (needsDetails) {
        this.fetchClusterDetail(data.detailKey, data.detailIndex)
          .then(detail => {
            const finalSummary =
              detail && Array.isArray(detail.topOffenses)
                ? { ...data.summary, ...detail }
                : data.summary
            data.summary = finalSummary
            this.updateInfoBubbleContent(bubble, position, finalSummary)
          })
          .catch(error => {
            console.error('Error loading cluster details:', error)
            this.updateInfoBubbleContent(bubble, position, data.summary)
          })
      }
    },

    hasClusterDetails(summary) {
      return Array.isArray(summary?.topOffenses)
    },

    async fetchClusterDetail(detailKey, detailIndex) {
      if (!detailKey && !Number.isFinite(detailIndex)) {
        return null
      }
      const cacheKey = detailKey || `index:${detailIndex}`
      const cached = this.bostonDetailCache.get(cacheKey)
      if (cached) {
        return cached
      }
      const query = new URLSearchParams()
      if (detailKey) {
        query.set('detailKey', detailKey)
      } else if (this.bostonDetailContext) {
        query.set('detailIndex', String(detailIndex))
        query.set('north', String(this.bostonDetailContext.north))
        query.set('south', String(this.bostonDetailContext.south))
        query.set('east', String(this.bostonDetailContext.east))
        query.set('west', String(this.bostonDetailContext.west))
        if (Number.isFinite(this.bostonDetailContext.zoom)) {
          query.set('zoom', String(this.bostonDetailContext.zoom))
        }
        query.set(
          'dangerLevel',
          String(this.bostonDetailContext.dangerLevel ?? 1),
        )
        if (Number.isFinite(this.bostonDetailContext.limit)) {
          query.set('limit', String(this.bostonDetailContext.limit))
        }
      } else {
        return null
      }

      let response = await fetch(
        `/.netlify/functions/boston-clusters?${query.toString()}`,
      )
      if (
        !response.ok &&
        detailKey &&
        this.bostonDetailContext &&
        Number.isFinite(detailIndex)
      ) {
        const fallbackQuery = new URLSearchParams()
        fallbackQuery.set('detailIndex', String(detailIndex))
        fallbackQuery.set('north', String(this.bostonDetailContext.north))
        fallbackQuery.set('south', String(this.bostonDetailContext.south))
        fallbackQuery.set('east', String(this.bostonDetailContext.east))
        fallbackQuery.set('west', String(this.bostonDetailContext.west))
        if (Number.isFinite(this.bostonDetailContext.zoom)) {
          fallbackQuery.set('zoom', String(this.bostonDetailContext.zoom))
        }
        fallbackQuery.set(
          'dangerLevel',
          String(this.bostonDetailContext.dangerLevel ?? 1),
        )
        if (Number.isFinite(this.bostonDetailContext.limit)) {
          fallbackQuery.set('limit', String(this.bostonDetailContext.limit))
        }
        response = await fetch(
          `/.netlify/functions/boston-clusters?${fallbackQuery.toString()}`,
        )
      }
      if (!response.ok) {
        throw new Error(`Cluster detail fetch failed: ${response.status}`)
      }
      const detail = await response.json()
      if (detail && Array.isArray(detail.topOffenses)) {
        this.bostonDetailCache.set(cacheKey, detail)
        if (this.bostonDetailCache.size > 100) {
          const oldestKey = this.bostonDetailCache.keys().next().value
          this.bostonDetailCache.delete(oldestKey)
        }
      }
      return detail
    },

    buildClusterInfoHtml(summary, isLoadingDetails) {
      const topOffensesList = Array.isArray(summary.topOffenses)
        ? summary.topOffenses
        : []
      const topOffenses =
        topOffensesList.length > 0
          ? topOffensesList
              .map(
                item =>
                  `<li>${this.escapeHtml(item.code)} - ${this.escapeHtml(
                    item.description,
                  )} (${item.count})</li>`,
              )
              .join('')
          : `<li>${isLoadingDetails ? 'Loading details...' : 'Details unavailable.'}</li>`

      const levelConfig = this.getDangerLevelConfig(summary.maxLevel || 1)
      const shootingLine =
        summary.shootingCount > 0
          ? `<div>Shooting reports: ${summary.shootingCount}</div>`
          : ''

      return `
        <div style="width:400px; max-width:400px; max-height:240px; overflow:auto; text-align:left; line-height:1.3;">
          <div style="font-weight:600; margin-bottom:6px;">Crime cluster</div>
          <div style="margin-bottom:4px;">Cluster level: ${summary.maxLevel} - ${this.escapeHtml(levelConfig.label)}</div>
          <div style="margin-bottom:4px;">Total incidents: ${summary.total}</div>
          <div style="margin-bottom:4px;">Unique offenses: ${summary.uniqueOffenses}</div>
          ${shootingLine}
          <div style="font-weight:600; margin-top:8px;">Top offenses</div>
          <ul style="margin:4px 0 6px 18px; padding:0;">
            ${topOffenses || '<li>Unknown</li>'}
          </ul>
        </div>
      `
    },

    updateInfoBubbleContent(bubble, position, summary) {
      if (!this.ui || !bubble) {
        return
      }
      const html = this.buildClusterInfoHtml(summary, false)
      const element = bubble.getElement?.()
      if (element) {
        bubble.setContent(html)
        this.tweakInfoBubbleLayout(bubble)
        return
      }

      const H = window.H
      const refreshed = new H.ui.InfoBubble(position, { content: html })
      this.ui.addBubble(refreshed)
      this.tweakInfoBubbleLayout(refreshed)
      this.activeInfoBubble = refreshed
    },

    escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },

    tweakInfoBubbleLayout(bubble) {
      const element = bubble?.getElement?.()
      if (!element) {
        return
      }
      element.style.maxWidth = '640px'
      const closeButton = element.querySelector('.H_ib_close')
      if (closeButton) {
        closeButton.style.position = 'absolute'
        closeButton.style.right = '8px'
        closeButton.style.top = '6px'
        closeButton.style.margin = '0'
      }
      const content = element.querySelector('.H_ib_content')
      if (content) {
        content.style.width = '100%'
      }
    },

    async recalculateRouteWithPolygons(map) {
      // This function will recalculate the route once, without recursion
      const router = this.platform.getRoutingService() // Use the latest Routing API

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

    initializeHereMap() {
      const H = window.H
      const mapContainer = this.$refs.hereMap
      mapContainer.style.touchAction = 'none'

      // Obtain the default map layers from the platform object
      const defaultLayers = this.platform.createDefaultLayers()
      const style = defaultLayers.vector.normal.map

      // Instantiate and display a map object:
      const map = new H.Map(mapContainer, style, {
        zoom: 14,
        center: this.center,
      })

      // Store the map instance
      this.map = map

      // Enable the event system and default interactions:
      this.mapEvents = new H.mapevents.MapEvents(map)
      this.behavior = new H.mapevents.Behavior(this.mapEvents)
      this.enableMapDragging()
      this.setupMarkerDragHandlers()
      this.setupDropTargets()
      // Ensure touch gestures are captured by the map viewport.
      map.getViewPort().element.style.touchAction = 'none'
      const ui = H.ui.UI.createDefault(map, defaultLayers)
      this.ui = ui
      map.addEventListener('tap', event => this.handleBostonClusterTap(event))

      // Adjust map viewport on window resize
      window.addEventListener('resize', () => map.getViewPort().resize())
      map.addEventListener('mapviewchangeend', () => {
        if (!this.isMarkerDragActive) {
          this.enableMapDragging()
        }
        if (!this.hasMapRendered) {
          this.hasMapRendered = true
          this.isMapLoading = false
        }
        this.scheduleBostonUpdate()
      })

      // Add the polygons to the map
      this.addPolygonsToMap(map)
    },

    async calculateRouteFromAtoB(map) {
      const router = this.platform.getRoutingService() // Use the latest Routing API

      if (this.bostonAvoidPolygons.length === 0) {
        await this.updateBostonPolygonsInView()
      }

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
      const maxPolygons = 20
      const maxPoints = 16
      const candidates = []
      const pinned = []
      const toPolygonString = points =>
        `polygon:${points.map(point => `${point.lat},${point.lng}`).join(';')}`

      const basePolygon = this.sanitizePolygonPoints(
        this.normalizePolygonCoords(this.polygonCoords1, 'lat', 'lng'),
        maxPoints,
      )
      if (basePolygon.length >= 3) {
        pinned.push({ points: basePolygon, priority: Number.POSITIVE_INFINITY })
      }

      if (this.apiPolygons && this.apiPolygons.length > 0) {
        this.apiPolygons.forEach(apiPolygon => {
          const points = this.sanitizePolygonPoints(
            this.normalizePolygonCoords(apiPolygon, 'lat', 'lon'),
            maxPoints,
          )
          if (points.length >= 3) {
            candidates.push({ points, priority: 100 })
          }
        })
      }

      if (this.bostonAvoidPolygons && this.bostonAvoidPolygons.length > 0) {
        const threshold = this.getDangerThreshold()
        this.bostonAvoidPolygons.forEach(item => {
          if (item.maxLevel >= threshold) {
            const points = this.sanitizePolygonPoints(
              this.normalizePolygonCoords(item.polygon, 'lat', 'lng'),
              maxPoints,
            )
            if (points.length >= 3) {
              const count = Number.isFinite(item.count) ? item.count : 0
              const priority = item.maxLevel * 100000 + count
              candidates.push({ points, priority })
            }
          }
        })
      }

      const avoidAreas = [...pinned]
      const remainingSlots = maxPolygons - avoidAreas.length
      if (remainingSlots > 0 && candidates.length > 0) {
        const sorted = candidates.sort((a, b) => b.priority - a.priority)
        avoidAreas.push(...sorted.slice(0, remainingSlots))
      }

      const serialized = avoidAreas.map(item => toPolygonString(item.points))
      console.log('Avoid areas:', serialized)
      return serialized.join('|')
    },

    async onSuccess(result, map) {
      const route = result.routes[0]

      // Clear previous routes and markers, but keep the search marker
      this.clearMapForRoute(map)

      // Add the polygons back to the map
      this.addPolygonsToMap(map)

      // Add the route polyline to the map
      this.addRouteShapeToMap(route, map)

      // Optionally, add markers and other route details
      this.addMarkersToMap(route)

      // Extract route instructions and summary
      const routeData = this.extractRouteInstructions(route)
      // Emit the data to the parent component
      this.$emit('route-instructions', routeData)

      const routeBounds = this.getRouteBounds(route)
      const expandedBounds = routeBounds
        ? this.expandBounds(routeBounds, BOSTON_VIEW_PADDING_RATIO)
        : null
      const dangerThreshold = this.getDangerThreshold()
      const zoom = this.map?.getZoom?.()

      // Fetch and add polygons from polyline to avoid crime areas
      const firstPolyline = route.sections[0].polyline
      const [polygons, bostonPayload] = await Promise.all([
        this.fetchPolygonsFromPolyline(firstPolyline),
        expandedBounds
          ? this.fetchBostonClusters(
              expandedBounds,
              Number.isFinite(zoom) ? zoom : null,
              dangerThreshold,
            )
          : null,
      ])

      if (polygons) {
        this.apiPolygons = polygons // Store the polygons for future use
        this.addPolygonsToMapFromAPI(polygons, map)
      }

      if (bostonPayload?.clusters) {
        this.setBostonAvoidPolygons(bostonPayload.clusters)
        this.renderBostonClusters(
          bostonPayload.clusters,
          bostonPayload.maxCount,
        )
      } else {
        this.bostonAvoidPolygons = []
      }

      if (
        (polygons && polygons.length > 0) ||
        this.bostonAvoidPolygons.length > 0
      ) {
        this.recalculateRouteWithPolygons(map)
      }
    },

    onSuccessRecalculate(result, map) {
      // This is a new success handler for recalculating the route once
      const route = result.routes[0]

      // Clear previous routes and markers, but keep the search marker
      this.clearMapForRoute(map)

      // Add the polygons back to the map
      this.addPolygonsToMap(map)

      this.addPolygonsToMapFromAPI(this.apiPolygons, map)

      // Add the recalculated route polyline to the map
      this.addRouteShapeToMap(route, map)

      // Optionally, add markers and other route details
      this.addMarkersToMap(route)

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

    addMarkersToMap(route) {
      if (!route?.sections?.length) {
        return
      }
      const firstSection = route.sections[0]
      const lastSection = route.sections[route.sections.length - 1]
      this.setEndpointMarker('origin', firstSection.departure.place.location)
      this.setEndpointMarker('destination', lastSection.arrival.place.location)
    },

    addPolygonsToMapFromAPI(polygons, map) {
      const H = window.H
      polygons.forEach(polygon => {
        const points = polygon.map(point => ({
          lat: point.lat,
          lng: point.lon,
        }))
        const polygonGeometry = this.buildPolygonGeometry(points)

        const dangerColor = this.getDangerColor()

        const polygonShape = new H.map.Polygon(polygonGeometry, {
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
      this.addCrimePolygonsToMap(this.crimePolygons, map)
      this.updateBostonPolygonsInView()

      if (!this.polygonCoords1 || this.polygonCoords1.length === 0) {
        return
      }

      const H = window.H
      const polygonGeometry1 = this.buildPolygonGeometry(this.polygonCoords1)

      // Create the first polygon
      const polygon1 = new H.map.Polygon(polygonGeometry1, {
        style: {
          fillColor: 'rgba(255, 0, 0, 0.5)', // Semi-transparent red
          strokeColor: 'red', // Border color
          lineWidth: 2,
        },
      })

      // Add the polygons to the map
      map.addObjects([polygon1])
    },
    buildPolygonGeometry(points) {
      const H = window.H
      const linestring = new H.geo.LineString()
      points.forEach(point => {
        linestring.pushPoint(point)
      })

      if (points.length > 0) {
        const firstPoint = points[0]
        const lastPoint = points[points.length - 1]
        if (
          firstPoint.lat !== lastPoint.lat ||
          firstPoint.lng !== lastPoint.lng
        ) {
          linestring.pushPoint(firstPoint)
        }
      }

      return new H.geo.Polygon(linestring)
    },

    async searchPlace(positionOverride) {
      if (!this.searchQuery) {
        // alert('Please enter a place to search.')
        if (
          !positionOverride ||
          !Number.isFinite(positionOverride.lat) ||
          !Number.isFinite(positionOverride.lng)
        ) {
          return
        }
      }
      try {
        const position =
          positionOverride &&
          Number.isFinite(positionOverride.lat) &&
          Number.isFinite(positionOverride.lng)
            ? positionOverride
            : await this.geocodeAddress(this.searchQuery)
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

    clearRoute() {
      this.apiPolygons = []
      if (this.map) {
        this.clearMapForRoute(this.map)
      }
      if (this.activeInfoBubble && this.ui) {
        this.ui.removeBubble(this.activeInfoBubble)
        this.activeInfoBubble = null
      }
    },
  },
  watch: {
    origin(newOrigin) {
      if (newOrigin && this.destination && this.map) {
        this.calculateRouteFromAtoB(this.map)
      }
      this.setEndpointMarker('origin', newOrigin)
    },
    destination(newDestination) {
      if (newDestination && this.origin && this.map) {
        this.calculateRouteFromAtoB(this.map)
      }
      this.setEndpointMarker('destination', newDestination)
    },
    transportMode() {
      if (this.origin && this.destination && this.map) {
        this.calculateRouteFromAtoB(this.map)
      }
    },
    dangerLevel() {
      this.scheduleBostonUpdate()
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
  width: 60%;
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

.legend-stack {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
}

.legend {
  background-color: rgba(255, 255, 255, 0.95);
  padding: 10px 12px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  text-align: left;
  max-width: 221px;
}

.legend-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  display: inline-block;
}

.legend-tip {
  background-color: rgba(255, 255, 255, 0.95);
  padding: 8px 10px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  font-size: 11px;
  color: #475569;
  line-height: 1.3;
  max-width: 221px;
  text-align: left;
}

.legend-tip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.legend-tip-item:first-child {
  margin-top: 0;
}

.legend-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0f172a;
  background: #e2e8f0;
  border: 1px solid rgba(15, 23, 42, 0.15);
  flex: 0 0 auto;
}

.legend-icon-info {
  background: #e0f2fe;
  color: #0369a1;
  border-color: rgba(2, 132, 199, 0.35);
}

.legend-icon-filter {
  background: #fef3c7;
  color: #b45309;
  border-color: rgba(217, 119, 6, 0.35);
}

.legend-icon-city {
  background: #ede9fe;
  color: #6d28d9;
  border-color: rgba(109, 40, 217, 0.35);
}

.legend-icon-warning {
  background: #fee2e2;
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.35);
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

.map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.85);
  z-index: 900;
  pointer-events: none;
}

.map-loading-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.15);
  color: #0f172a;
  font-size: 13px;
}

.map-loading-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #cbd5f5;
  border-top-color: #2563eb;
  animation: mapSpin 0.9s linear infinite;
}

@keyframes mapSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
