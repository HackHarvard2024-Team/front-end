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
          <span>Zoom in to click a cluster and see why it is risky.</span>
        </div>
        <div class="legend-tip-item">
          <span class="legend-icon legend-icon-filter">3</span>
          <span>Default safety filter starts at Level 3.</span>
        </div>
        <div class="legend-tip-item">
          <span class="legend-icon legend-icon-city">B</span>
          <span>Currently focused on Boston data.</span>
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
const BOSTON_CSV_URL = new URL('../assets/boston.csv', import.meta.url).href
const BOSTON_CSV_ROW_LIMIT = 20000
const BOSTON_VIEW_PADDING_RATIO = 0.15
const BOSTON_CLUSTER_RADIUS_MIN_METERS = 35
const BOSTON_CLUSTER_RADIUS_MAX_METERS = 140
const BOSTON_CLUSTER_RADIUS_BASE_METERS = 70
const BOSTON_CLUSTER_ZOOM_REFERENCE = 14
const BOSTON_CLUSTER_ZOOM_SCALE = 1.2
const BOSTON_CLUSTER_MAX_POINTS = 6000
const BOSTON_CLUSTER_MIN_POINTS = 1
const BOSTON_CLUSTER_EXPANSION_MAX = 0.1
const BOSTON_CLUSTER_SMALL_POLY_SIDES = 6
const BOSTON_CLUSTER_TOP_OFFENSE_LIMIT = 4
const BOSTON_CLUSTER_SAMPLE_LIMIT = 8
const DEFAULT_MAP_ZOOM = 14
const BOSTON_DANGER_LEVELS = [
  { level: 1, label: 'Low', rgb: '34,197,94' },
  { level: 2, label: 'Guarded', rgb: '132,204,22' },
  { level: 3, label: 'Elevated', rgb: '234,179,8' },
  { level: 4, label: 'High', rgb: '249,115,22' },
  { level: 5, label: 'Severe', rgb: '239,68,68' },
]
const BOSTON_EXCLUDED_KEYWORDS = [
  'INVESTIGATE PERSON',
  'INVESTIGATE PROPERTY',
  'VERBAL DISPUTE',
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
      hasAppliedInitialView: false,
      searchQuery: '',
      searchMarker: null, // Marker for the searched place
      apiPolygons: [], // Add this to store API polygons
      crimePolygons: [],
      crimePolygonsLoading: false,
      bostonPoints: [],
      bostonPolygonObjects: [],
      bostonPolygonsLoading: false,
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
    this.loadBostonPoints()
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
    applyInitialView(force = false) {
      if (!this.map) {
        return
      }
      if (this.hasAppliedInitialView && !force) {
        return
      }
      const center =
        this.center &&
        Number.isFinite(this.center.lat) &&
        Number.isFinite(this.center.lng)
          ? this.center
          : { lat: 42.3601, lng: -71.0589 }
      this.map
        .getViewModel()
        .setLookAtData({ position: center, zoom: DEFAULT_MAP_ZOOM }, true)
      this.hasAppliedInitialView = true
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

    async loadBostonPoints() {
      if (this.bostonPolygonsLoading || this.bostonPoints.length > 0) {
        return
      }
      this.bostonPolygonsLoading = true
      try {
        const response = await fetch(BOSTON_CSV_URL)
        if (!response.ok) {
          throw new Error(`Boston CSV fetch failed: ${response.status}`)
        }
        const csvText = await response.text()
        const points = this.parseBostonCsvPoints(csvText, BOSTON_CSV_ROW_LIMIT)
        this.bostonPoints = points
        this.scheduleBostonUpdate()
      } catch (error) {
        console.error('Error loading Boston crime CSV:', error)
      } finally {
        this.bostonPolygonsLoading = false
      }
    },

    parseBostonCsvPoints(csvText, limit) {
      const points = []
      let row = []
      let field = ''
      let inQuotes = false
      let rowIndex = 0
      let latIndex = -1
      let lngIndex = -1
      let offenseCodeIndex = -1
      let offenseGroupIndex = -1
      let offenseDescriptionIndex = -1
      let occurredOnDateIndex = -1
      let shootingIndex = -1
      let ucrPartIndex = -1

      const normalizeHeader = value =>
        value
          .trim()
          .replace(/^\uFEFF/, '')
          .toLowerCase()

      const processRow = () => {
        if (rowIndex === 0) {
          row.forEach((value, index) => {
            const header = normalizeHeader(value)
            if (header === 'lat' || header === 'latitude') {
              latIndex = index
            }
            if (
              header === 'long' ||
              header === 'lng' ||
              header === 'longitude'
            ) {
              lngIndex = index
            }
            if (header === 'offense_code') {
              offenseCodeIndex = index
            }
            if (header === 'offense_code_group') {
              offenseGroupIndex = index
            }
            if (header === 'offense_description') {
              offenseDescriptionIndex = index
            }
            if (header === 'occurred_on_date') {
              occurredOnDateIndex = index
            }
            if (header === 'shooting') {
              shootingIndex = index
            }
            if (header === 'ucr_part') {
              ucrPartIndex = index
            }
          })
          rowIndex += 1
          row = []
          return
        }

        if (latIndex === -1 || lngIndex === -1) {
          rowIndex += 1
          row = []
          return
        }

        if (points.length < limit) {
          const latValue = row[latIndex]?.trim()
          const lngValue = row[lngIndex]?.trim()
          const lat = Number.parseFloat(latValue)
          const lng = Number.parseFloat(lngValue)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const offenseCode = row[offenseCodeIndex]?.trim()
            const offenseGroup = row[offenseGroupIndex]?.trim()
            const offenseDescription = row[offenseDescriptionIndex]?.trim()
            const occurredOnDate = row[occurredOnDateIndex]?.trim()
            const shooting = row[shootingIndex]?.trim()
            const ucrPart = row[ucrPartIndex]?.trim()

            if (
              this.isExcludedOffense(offenseDescription, offenseGroup, ucrPart)
            ) {
              rowIndex += 1
              row = []
              return
            }

            const dangerLevel = this.getDangerLevelForOffense({
              offenseDescription,
              offenseGroup,
              offenseCode,
              shooting,
              ucrPart,
            })

            points.push({
              lat,
              lng,
              offenseCode: offenseCode || 'N/A',
              offenseDescription:
                offenseDescription || offenseGroup || 'Unknown offense',
              offenseGroup: offenseGroup || '',
              occurredOnDate: occurredOnDate || '',
              shooting: shooting || '',
              ucrPart: ucrPart || '',
              dangerLevel,
            })
          }
        }

        rowIndex += 1
        row = []
      }

      for (let i = 0; i < csvText.length; i += 1) {
        const char = csvText[i]

        if (inQuotes) {
          if (char === '"') {
            if (csvText[i + 1] === '"') {
              field += '"'
              i += 1
            } else {
              inQuotes = false
            }
          } else {
            field += char
          }
          continue
        }

        if (char === '"') {
          inQuotes = true
          continue
        }

        if (char === ',') {
          row.push(field)
          field = ''
          continue
        }

        if (char === '\n') {
          row.push(field)
          field = ''
          processRow()
          if (points.length >= limit) {
            return points
          }
          continue
        }

        if (char === '\r') {
          continue
        }

        field += char
      }

      if (field.length > 0 || row.length > 0) {
        row.push(field)
        processRow()
      }

      return points
    },

    updateBostonPolygonsInView() {
      if (!this.map || this.bostonPoints.length === 0) {
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
      const visiblePoints = this.filterPointsInBounds(
        this.bostonPoints,
        expanded,
        BOSTON_CLUSTER_MAX_POINTS,
      )
      const threshold = this.getDangerThreshold()
      const filteredPoints = visiblePoints.filter(
        point => point.dangerLevel >= threshold,
      )
      const zoom = this.map?.getZoom?.()
      const radiusMeters = this.getBostonClusterRadiusMeters(
        Number.isFinite(zoom) ? zoom : BOSTON_CLUSTER_ZOOM_REFERENCE,
      )
      const centerLat = (expanded.north + expanded.south) / 2
      const clusters = this.clusterBostonPoints(
        filteredPoints,
        radiusMeters,
        centerLat,
      )
      this.renderBostonClusters(clusters, radiusMeters)
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

    filterPointsInBounds(points, bounds, limit) {
      const filtered = []
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i]
        if (
          point.lat <= bounds.north &&
          point.lat >= bounds.south &&
          point.lng >= bounds.west &&
          point.lng <= bounds.east
        ) {
          filtered.push(point)
          if (limit && filtered.length >= limit) {
            break
          }
        }
      }
      return filtered
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

    isExcludedOffense(offenseDescription, offenseGroup, ucrPart) {
      const text =
        `${offenseDescription || ''} ${offenseGroup || ''} ${ucrPart || ''}`
          .toUpperCase()
          .trim()
      if (!text) {
        return false
      }
      return BOSTON_EXCLUDED_KEYWORDS.some(keyword => text.includes(keyword))
    },

    getDangerLevelForOffense({
      offenseDescription,
      offenseGroup,
      offenseCode,
      shooting,
      ucrPart,
    }) {
      const text =
        `${offenseDescription || ''} ${offenseGroup || ''} ${offenseCode || ''}`
          .toUpperCase()
          .trim()
      const ucrText = (ucrPart || '').toUpperCase()
      const shootingFlag = String(shooting || '').trim()

      const matchAny = keywords =>
        keywords.some(keyword => text.includes(keyword))

      if (shootingFlag === '1') {
        return 5
      }

      if (
        matchAny([
          'HOMICIDE',
          'MURDER',
          'MANSLAUGHTER',
          'RAPE',
          'SEXUAL ASSAULT',
          'KIDNAPPING',
          'HUMAN TRAFFICKING',
        ])
      ) {
        return 5
      }

      if (
        matchAny([
          'ROBBERY',
          'AGGRAVATED ASSAULT',
          'ASSAULT - AGGRAVATED',
          'FIREARM',
          'GUN',
          'WEAPON',
          'ARMED',
          'CARJACKING',
          'BURGLARY',
          'ARSON',
          'SEX OFFENSE',
        ])
      ) {
        return 4
      }

      if (
        matchAny([
          'ASSAULT',
          'BATTERY',
          'STALKING',
          'THREAT',
          'DOMESTIC',
          'DRUG',
          'NARCOTIC',
          'OUI',
          'DUI',
        ])
      ) {
        return 3
      }

      if (
        matchAny([
          'LARCENY',
          'THEFT',
          'FRAUD',
          'FORGERY',
          'EMBEZZLEMENT',
          'SHOPLIFT',
          'TRESPASS',
          'VANDAL',
          'PROPERTY',
          'MOTOR VEHICLE',
          'AUTO THEFT',
          'STOLEN',
        ])
      ) {
        return 2
      }

      if (ucrText.includes('PART ONE')) {
        return 4
      }
      if (ucrText.includes('PART TWO')) {
        return 3
      }
      if (ucrText.includes('PART THREE')) {
        return 1
      }

      return 1
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

    getBostonClusterRadiusMeters(zoom) {
      const zoomDelta = BOSTON_CLUSTER_ZOOM_REFERENCE - zoom
      const meters =
        BOSTON_CLUSTER_RADIUS_BASE_METERS *
        Math.pow(BOSTON_CLUSTER_ZOOM_SCALE, zoomDelta)
      return Math.min(
        BOSTON_CLUSTER_RADIUS_MAX_METERS,
        Math.max(BOSTON_CLUSTER_RADIUS_MIN_METERS, meters),
      )
    },

    clusterBostonPoints(points, radiusMeters, referenceLat) {
      if (!points || points.length === 0) {
        return []
      }
      const { deltaLat, deltaLng } = this.getLatLngDelta(
        referenceLat,
        radiusMeters,
      )
      const latStep = deltaLat
      const lngStep = deltaLng
      if (!Number.isFinite(latStep) || !Number.isFinite(lngStep)) {
        return []
      }

      const grid = new Map()
      const cellCoords = new Array(points.length)

      points.forEach((point, index) => {
        const latKey = Math.floor(point.lat / latStep)
        const lngKey = Math.floor(point.lng / lngStep)
        cellCoords[index] = { latKey, lngKey }
        const key = `${latKey}:${lngKey}`
        const bucket = grid.get(key)
        if (bucket) {
          bucket.push(index)
        } else {
          grid.set(key, [index])
        }
      })

      const radiusSquared = radiusMeters * radiusMeters
      const visited = new Array(points.length).fill(false)
      const clusters = []
      const neighborRange = 2

      for (let i = 0; i < points.length; i += 1) {
        if (visited[i]) {
          continue
        }
        visited[i] = true
        const seedPoint = points[i]
        const cluster = [seedPoint]
        const { latKey, lngKey } = cellCoords[i]

        for (
          let latOffset = -neighborRange;
          latOffset <= neighborRange;
          latOffset += 1
        ) {
          for (
            let lngOffset = -neighborRange;
            lngOffset <= neighborRange;
            lngOffset += 1
          ) {
            const neighborKey = `${latKey + latOffset}:${lngKey + lngOffset}`
            const neighbors = grid.get(neighborKey)
            if (!neighbors) {
              continue
            }
            for (let j = 0; j < neighbors.length; j += 1) {
              const neighborIndex = neighbors[j]
              if (visited[neighborIndex]) {
                continue
              }
              const neighborPoint = points[neighborIndex]
              if (
                this.distanceSquaredMeters(
                  seedPoint,
                  neighborPoint,
                  seedPoint.lat,
                ) <= radiusSquared
              ) {
                visited[neighborIndex] = true
                cluster.push(neighborPoint)
              }
            }
          }
        }

        if (cluster.length >= BOSTON_CLUSTER_MIN_POINTS) {
          clusters.push(cluster)
        }
      }

      return clusters
    },

    renderBostonClusters(clusters, radiusMeters) {
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
      const maxCount = Math.max(1, ...clusters.map(cluster => cluster.length))
      clusters.forEach(cluster => {
        const clusterCentroid = this.getClusterCentroid(cluster)
        const summary = this.buildClusterSummary(cluster)
        const intensity = Math.min(1, cluster.length / maxCount)
        const clusterLevel = summary.maxLevel || 1
        const style = {
          ...this.getDangerStyleForLevel(clusterLevel, intensity),
          lineWidth: 1,
        }
        const polygonPoints = this.clusterToPolygon(cluster, radiusMeters)
        if (!polygonPoints || polygonPoints.length < 3) {
          return
        }
        const polygonGeometry = this.buildPolygonGeometry(polygonPoints)
        const polygonShape = new H.map.Polygon(polygonGeometry, { style })
        polygonShape.setData({
          summary,
          centroid: clusterCentroid,
          level: clusterLevel,
        })
        polygonShape.addEventListener('tap', event =>
          this.handleBostonClusterTap(event),
        )
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

      const content = this.buildClusterInfoHtml(data.summary)
      if (this.activeInfoBubble) {
        this.ui.removeBubble(this.activeInfoBubble)
      }
      const bubble = new H.ui.InfoBubble(position, { content })
      this.ui.addBubble(bubble)
      this.tweakInfoBubbleLayout(bubble)
      this.activeInfoBubble = bubble
    },

    buildClusterSummary(cluster) {
      const offenseMap = new Map()
      const samples = []
      let shootingCount = 0
      const levelCounts = new Map()
      let maxLevel = 1

      cluster.forEach(point => {
        const offenseCode = point.offenseCode || 'N/A'
        const offenseDescription = point.offenseDescription || 'Unknown offense'
        const key = `${offenseCode}::${offenseDescription}`
        const existing = offenseMap.get(key)
        if (existing) {
          existing.count += 1
        } else {
          offenseMap.set(key, {
            code: offenseCode,
            description: offenseDescription,
            count: 1,
          })
        }

        const shootingValue = String(point.shooting || '')
          .trim()
          .toLowerCase()
        if (shootingValue === '1' || shootingValue === 'y') {
          shootingCount += 1
        }

        if (samples.length < BOSTON_CLUSTER_SAMPLE_LIMIT) {
          samples.push({
            code: offenseCode,
            description: offenseDescription,
            occurredOnDate: point.occurredOnDate || '',
          })
        }

        const level = Number.isFinite(point.dangerLevel) ? point.dangerLevel : 1
        levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1)
        if (level > maxLevel) {
          maxLevel = level
        }
      })

      const topOffenses = Array.from(offenseMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, BOSTON_CLUSTER_TOP_OFFENSE_LIMIT)

      return {
        total: cluster.length,
        uniqueOffenses: offenseMap.size,
        topOffenses,
        samples,
        shootingCount,
        maxLevel,
        levelCounts,
      }
    },

    buildClusterInfoHtml(summary) {
      const topOffenses = summary.topOffenses
        .map(
          item =>
            `<li>${this.escapeHtml(item.code)} - ${this.escapeHtml(
              item.description,
            )} (${item.count})</li>`,
        )
        .join('')

      const sampleItems = summary.samples
        .map(item => {
          const dateLabel = this.formatOccurredOnDate(item.occurredOnDate)
          const crimeLabel = `${item.code} - ${item.description}`
          const details = dateLabel
            ? `${dateLabel} · ${crimeLabel}`
            : crimeLabel
          return `<li>${this.escapeHtml(details)}</li>`
        })
        .join('')

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
          <div style="font-weight:600; margin-top:6px;">
            Sample crimes (${summary.samples.length} of ${summary.total})
          </div>
          <ul style="margin:4px 0 0 18px; padding:0;">
            ${sampleItems || '<li>Unknown</li>'}
          </ul>
        </div>
      `
    },

    formatOccurredOnDate(value) {
      if (!value) {
        return ''
      }
      const trimmed = value.trim()
      if (!trimmed) {
        return ''
      }
      const parts = trimmed.split(' ')
      if (parts.length < 2) {
        return trimmed
      }
      const time = parts[1].replace(/\+.*$/, '')
      return `${parts[0]} ${time}`
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

    clusterToPolygon(cluster, radiusMeters) {
      if (!cluster || cluster.length === 0) {
        return []
      }
      const centroid = this.getClusterCentroid(cluster)
      if (cluster.length < 3) {
        const radiusScale = Math.min(1, 0.55 + cluster.length * 0.2)
        return this.buildRegularPolygon(
          centroid,
          radiusMeters * radiusScale,
          BOSTON_CLUSTER_SMALL_POLY_SIDES,
        )
      }

      const hull = this.computeConvexHull(cluster)
      if (!hull || hull.length < 3) {
        return this.buildRegularPolygon(
          centroid,
          radiusMeters,
          BOSTON_CLUSTER_SMALL_POLY_SIDES,
        )
      }
      const expansion =
        1 +
        Math.min(BOSTON_CLUSTER_EXPANSION_MAX, Math.log(cluster.length + 1) / 6)
      const expanded = this.scalePolygonFromCentroid(hull, centroid, expansion)
      return this.clampPolygonToRadius(expanded, centroid, radiusMeters)
    },

    computeConvexHull(points) {
      if (!points || points.length <= 2) {
        return points ? [...points] : []
      }
      const sorted = [...points].sort((a, b) => {
        if (a.lng === b.lng) {
          return a.lat - b.lat
        }
        return a.lng - b.lng
      })

      const cross = (o, a, b) =>
        (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng)

      const lower = []
      sorted.forEach(point => {
        while (
          lower.length >= 2 &&
          cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
        ) {
          lower.pop()
        }
        lower.push(point)
      })

      const upper = []
      for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const point = sorted[i]
        while (
          upper.length >= 2 &&
          cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
        ) {
          upper.pop()
        }
        upper.push(point)
      }

      lower.pop()
      upper.pop()
      return lower.concat(upper)
    },

    scalePolygonFromCentroid(points, centroid, scale) {
      return points.map(point => ({
        lat: centroid.lat + (point.lat - centroid.lat) * scale,
        lng: centroid.lng + (point.lng - centroid.lng) * scale,
      }))
    },

    buildRegularPolygon(center, radiusMeters, sides) {
      const { deltaLat, deltaLng } = this.getLatLngDelta(
        center.lat,
        radiusMeters,
      )
      const polygon = []
      const step = (Math.PI * 2) / sides

      for (let i = 0; i < sides; i += 1) {
        const angle = step * i
        polygon.push({
          lat: center.lat + Math.sin(angle) * deltaLat,
          lng: center.lng + Math.cos(angle) * deltaLng,
        })
      }

      return polygon
    },

    clampPolygonToRadius(points, centroid, radiusMeters) {
      const maxDistance = radiusMeters
      return points.map(point => {
        const distanceSquared = this.distanceSquaredMeters(
          point,
          centroid,
          centroid.lat,
        )
        if (distanceSquared <= maxDistance * maxDistance) {
          return point
        }
        const distance = Math.sqrt(distanceSquared)
        const scale = distance > 0 ? maxDistance / distance : 1
        return {
          lat: centroid.lat + (point.lat - centroid.lat) * scale,
          lng: centroid.lng + (point.lng - centroid.lng) * scale,
        }
      })
    },

    getClusterCentroid(points) {
      let sumLat = 0
      let sumLng = 0
      for (let i = 0; i < points.length; i += 1) {
        sumLat += points[i].lat
        sumLng += points[i].lng
      }
      return {
        lat: sumLat / points.length,
        lng: sumLng / points.length,
      }
    },

    distanceSquaredMeters(pointA, pointB, referenceLat) {
      const latRadians =
        ((referenceLat ?? (pointA.lat + pointB.lat) / 2) * Math.PI) / 180
      const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.max(Math.cos(latRadians), 0.01)
      const dx = (pointA.lng - pointB.lng) * metersPerDegreeLng
      const dy = (pointA.lat - pointB.lat) * METERS_PER_DEGREE_LAT
      return dx * dx + dy * dy
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
        zoom: DEFAULT_MAP_ZOOM,
        center: this.center,
      })

      // Store the map instance
      this.map = map

      // Enable the event system and default interactions:
      this.mapEvents = new H.mapevents.MapEvents(map)
      this.behavior = new H.mapevents.Behavior(this.mapEvents)
      // Ensure touch gestures are captured by the map viewport.
      map.getViewPort().element.style.touchAction = 'none'
      const ui = H.ui.UI.createDefault(map, defaultLayers)
      this.ui = ui
      this.applyInitialView(true)
      requestAnimationFrame(() => {
        map.getViewPort().resize()
        this.applyInitialView(true)
      })

      // Adjust map viewport on window resize
      window.addEventListener('resize', () => map.getViewPort().resize())
      map.addEventListener('mapviewchangeend', () => {
        if (!this.hasMapRendered) {
          this.hasMapRendered = true
          this.isMapLoading = false
        }
        this.scheduleBostonUpdate()
      })

      // Add the polygons to the map
      this.addPolygonsToMap(map)
    },

    calculateRouteFromAtoB(map) {
      const router = this.platform.getRoutingService() // Use the latest Routing API

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
        map.getObjects().filter(obj => obj !== this.searchMarker),
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
