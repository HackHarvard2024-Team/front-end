const jsonResponse = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
})

const CHICAGO_SODA_URL = 'https://data.cityofchicago.org/resource/ijzp-q8t2.json'
const CHICAGO_START_YEAR = 2023
const METERS_PER_DEGREE_LAT = 111320
const CHICAGO_CLUSTER_RADIUS_MIN_METERS = 35
const CHICAGO_CLUSTER_RADIUS_MAX_METERS = 140
const CHICAGO_CLUSTER_RADIUS_BASE_METERS = 70
const CHICAGO_CLUSTER_ZOOM_REFERENCE = 14
const CHICAGO_CLUSTER_ZOOM_SCALE = 1.2
const CHICAGO_CLUSTER_MIN_POINTS = 1
const CHICAGO_CLUSTER_EXPANSION_MAX = 0.1
const CHICAGO_CLUSTER_SMALL_POLY_SIDES = 6
const CHICAGO_CLUSTER_TOP_OFFENSE_LIMIT = 3
const CHICAGO_VIEW_POINT_LIMIT = 4000
const CACHE_TTL_MS = 30000
const CACHE_MAX_ENTRIES = 60
const OUTPUT_COORD_DECIMALS = 5
const CHICAGO_EXCLUDED_KEYWORDS = [
  'NON-CRIMINAL',
  'NON CRIMINAL',
  'OTHER OFFENSE',
  'DECEPTIVE PRACTICE',
  'LIQUOR LAW VIOLATION',
  'PUBLIC PEACE VIOLATION',
]

const responseCache = new Map()
const detailCache = new Map()

const roundCoord = (value, decimals) => {
  if (!Number.isFinite(value)) {
    return value
  }
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

const roundPoint = point => ({
  lat: roundCoord(point.lat, OUTPUT_COORD_DECIMALS),
  lng: roundCoord(point.lng, OUTPUT_COORD_DECIMALS),
})

const getCacheKey = ({ bounds, zoom, dangerLevel, limit }) => {
  const normalized = {
    north: roundCoord(bounds.north, 4),
    south: roundCoord(bounds.south, 4),
    east: roundCoord(bounds.east, 4),
    west: roundCoord(bounds.west, 4),
    zoom: Number.isFinite(zoom) ? roundCoord(zoom, 2) : null,
    dangerLevel,
    limit,
  }
  return JSON.stringify(normalized)
}

const buildDetailKey = (cacheKey, index) => `${cacheKey}::${index}`

const parseDetailKey = value => {
  if (!value) {
    return null
  }
  const splitIndex = value.lastIndexOf('::')
  if (splitIndex === -1) {
    return null
  }
  const cacheKey = value.slice(0, splitIndex)
  const index = Number.parseInt(value.slice(splitIndex + 2), 10)
  if (!Number.isFinite(index)) {
    return null
  }
  return { cacheKey, index }
}

const parseCacheKey = value => {
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

const getCachedEntry = (cache, key) => {
  const entry = cache.get(key)
  if (!entry) {
    return null
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  cache.delete(key)
  cache.set(key, entry)
  return entry.payload
}

const setCachedEntry = (cache, key, payload) => {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    cache.delete(oldestKey)
  }
}

const parseNumber = value => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

const clampDangerLevel = level => {
  if (!Number.isFinite(level) || level <= 0) {
    return 1
  }
  return Math.min(5, Math.max(1, level))
}

const normalizeBounds = params => {
  const north = parseNumber(params?.north)
  const south = parseNumber(params?.south)
  const east = parseNumber(params?.east)
  const west = parseNumber(params?.west)
  if (north === null || south === null || east === null || west === null) {
    return null
  }
  return {
    north: Math.max(north, south),
    south: Math.min(north, south),
    east: Math.max(east, west),
    west: Math.min(east, west),
  }
}

const getLatLngDelta = (lat, radiusMeters) => {
  const latRadians = (lat * Math.PI) / 180
  const metersPerDegreeLng =
    METERS_PER_DEGREE_LAT * Math.max(Math.cos(latRadians), 0.01)
  return {
    deltaLat: radiusMeters / METERS_PER_DEGREE_LAT,
    deltaLng: radiusMeters / metersPerDegreeLng,
  }
}

const distanceSquaredMeters = (pointA, pointB, referenceLat) => {
  const latRadians =
    ((referenceLat ?? (pointA.lat + pointB.lat) / 2) * Math.PI) / 180
  const metersPerDegreeLng =
    METERS_PER_DEGREE_LAT * Math.max(Math.cos(latRadians), 0.01)
  const dx = (pointA.lng - pointB.lng) * metersPerDegreeLng
  const dy = (pointA.lat - pointB.lat) * METERS_PER_DEGREE_LAT
  return dx * dx + dy * dy
}

const isExcludedOffense = (offenseDescription, offenseGroup, fbiCode) => {
  const text =
    `${offenseDescription || ''} ${offenseGroup || ''} ${fbiCode || ''}`
      .toUpperCase()
      .trim()
  if (!text) {
    return false
  }
  return CHICAGO_EXCLUDED_KEYWORDS.some(keyword => text.includes(keyword))
}

const getDangerLevelForOffense = ({
  offenseDescription,
  offenseGroup,
  offenseCode,
  shooting,
  ucrPart,
}) => {
  const text =
    `${offenseDescription || ''} ${offenseGroup || ''} ${offenseCode || ''}`
      .toUpperCase()
      .trim()
  const ucrText = (ucrPart || '').toUpperCase()
  const shootingFlag = String(shooting || '').trim()

  const matchAny = keywords => keywords.some(keyword => text.includes(keyword))

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
}

const fetchChicagoPoints = async (bounds, limit) => {
  const north = roundCoord(bounds.north, 5)
  const south = roundCoord(bounds.south, 5)
  const east = roundCoord(bounds.east, 5)
  const west = roundCoord(bounds.west, 5)

  const where = [
    `year >= ${CHICAGO_START_YEAR}`,
    'latitude IS NOT NULL',
    'longitude IS NOT NULL',
    `latitude BETWEEN ${south} AND ${north}`,
    `longitude BETWEEN ${west} AND ${east}`,
  ].join(' AND ')

  const url = new URL(CHICAGO_SODA_URL)
  url.searchParams.set(
    '$select',
    [
      'date',
      'primary_type',
      'description',
      'iucr',
      'fbi_code',
      'arrest',
      'domestic',
      'latitude',
      'longitude',
      'location_description',
      'year',
    ].join(','),
  )
  url.searchParams.set('$where', where)
  url.searchParams.set('$order', 'date DESC')
  url.searchParams.set('$limit', String(limit))

  const headers = { Accept: 'application/json' }
  const appToken = process.env.CHICAGO_OPEN_DATA_APP_TOKEN
  if (appToken) {
    headers['X-App-Token'] = appToken
  }

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Chicago Open Data fetch failed: ${response.status} ${text}`,
    )
  }
  const rows = await response.json()
  if (!Array.isArray(rows)) {
    return []
  }

  const points = []
  rows.forEach(row => {
    const lat = parseNumber(row.latitude)
    const lng = parseNumber(row.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }
    const offenseGroup = row.primary_type?.trim() || ''
    const offenseDescription = row.description?.trim() || ''
    const offenseCode = row.iucr?.trim() || ''
    const fbiCode = row.fbi_code?.trim() || ''

    if (isExcludedOffense(offenseDescription, offenseGroup, fbiCode)) {
      return
    }

    const dangerLevel = getDangerLevelForOffense({
      offenseDescription,
      offenseGroup,
      offenseCode,
      shooting: null,
      ucrPart: fbiCode,
    })

    points.push({
      lat,
      lng,
      offenseCode: offenseCode || 'N/A',
      offenseDescription: offenseDescription || offenseGroup || 'Unknown offense',
      offenseGroup,
      occurredOnDate: row.date || '',
      shooting: '',
      dangerLevel,
    })
  })

  return points
}

const filterPointsInBounds = (points, bounds, limit) => {
  if (!points || points.length === 0) {
    return []
  }
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
      if (filtered.length >= limit) {
        return filtered
      }
    }
  }
  return filtered
}

const getChicagoClusterRadiusMeters = zoom => {
  if (!Number.isFinite(zoom)) {
    return CHICAGO_CLUSTER_RADIUS_BASE_METERS
  }
  const scale = Math.pow(
    CHICAGO_CLUSTER_ZOOM_SCALE,
    CHICAGO_CLUSTER_ZOOM_REFERENCE - zoom,
  )
  const radius = CHICAGO_CLUSTER_RADIUS_BASE_METERS * scale
  return Math.min(
    CHICAGO_CLUSTER_RADIUS_MAX_METERS,
    Math.max(CHICAGO_CLUSTER_RADIUS_MIN_METERS, radius),
  )
}

const clusterChicagoPoints = (points, radiusMeters, referenceLat) => {
  if (!points || points.length === 0) {
    return []
  }

  const latStep = radiusMeters / METERS_PER_DEGREE_LAT
  const lngStep =
    radiusMeters /
    (METERS_PER_DEGREE_LAT * Math.max(Math.cos((referenceLat * Math.PI) / 180), 0.01))

  const grid = new Map()
  const cellCoords = new Array(points.length)

  points.forEach((point, index) => {
    const latKey = Math.floor(point.lat / latStep)
    const lngKey = Math.floor(point.lng / lngStep)
    const key = `${latKey}:${lngKey}`
    cellCoords[index] = { latKey, lngKey }
    const bucket = grid.get(key)
    if (bucket) {
      bucket.push(index)
    } else {
      grid.set(key, [index])
    }
  })

  const visited = new Array(points.length).fill(false)
  const clusters = []
  const radiusSquared = radiusMeters * radiusMeters

  for (let i = 0; i < points.length; i += 1) {
    if (visited[i]) {
      continue
    }
    visited[i] = true
    const cluster = [points[i]]
    const seedPoint = points[i]
    const { latKey, lngKey } = cellCoords[i]

    for (let latDelta = -1; latDelta <= 1; latDelta += 1) {
      for (let lngDelta = -1; lngDelta <= 1; lngDelta += 1) {
        const key = `${latKey + latDelta}:${lngKey + lngDelta}`
        const bucket = grid.get(key)
        if (!bucket) {
          continue
        }
        for (let b = 0; b < bucket.length; b += 1) {
          const neighborIndex = bucket[b]
          if (visited[neighborIndex]) {
            continue
          }
          const neighborPoint = points[neighborIndex]
          if (
            distanceSquaredMeters(seedPoint, neighborPoint, seedPoint.lat) <=
            radiusSquared
          ) {
            visited[neighborIndex] = true
            cluster.push(neighborPoint)
          }
        }
      }
    }

    if (cluster.length >= CHICAGO_CLUSTER_MIN_POINTS) {
      clusters.push(cluster)
    }
  }

  return clusters
}

const computeConvexHull = points => {
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
}

const scalePolygonFromCentroid = (points, centroid, scale) =>
  points.map(point => ({
    lat: centroid.lat + (point.lat - centroid.lat) * scale,
    lng: centroid.lng + (point.lng - centroid.lng) * scale,
  }))

const buildRegularPolygon = (center, radiusMeters, sides) => {
  const { deltaLat, deltaLng } = getLatLngDelta(center.lat, radiusMeters)
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
}

const clampPolygonToRadius = (points, centroid, radiusMeters) => {
  const maxDistance = radiusMeters
  return points.map(point => {
    const distanceSquared = distanceSquaredMeters(point, centroid, centroid.lat)
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
}

const getClusterCentroid = points => {
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
}

const clusterToPolygon = (cluster, radiusMeters) => {
  if (!cluster || cluster.length === 0) {
    return []
  }
  const centroid = getClusterCentroid(cluster)
  if (cluster.length < 3) {
    const radiusScale = Math.min(1, 0.55 + cluster.length * 0.2)
    return buildRegularPolygon(
      centroid,
      radiusMeters * radiusScale,
      CHICAGO_CLUSTER_SMALL_POLY_SIDES,
    )
  }

  const hull = computeConvexHull(cluster)
  if (!hull || hull.length < 3) {
    return buildRegularPolygon(
      centroid,
      radiusMeters,
      CHICAGO_CLUSTER_SMALL_POLY_SIDES,
    )
  }
  const expansion =
    1 + Math.min(CHICAGO_CLUSTER_EXPANSION_MAX, Math.log(cluster.length + 1) / 6)
  const expanded = scalePolygonFromCentroid(hull, centroid, expansion)
  return clampPolygonToRadius(expanded, centroid, radiusMeters)
}

const buildClusterAggregates = cluster => {
  const offenseSet = new Set()
  let shootingCount = 0
  let maxLevel = 1

  cluster.forEach(point => {
    const offenseCode = point.offenseCode || 'N/A'
    const offenseDescription = point.offenseDescription || 'Unknown offense'
    offenseSet.add(`${offenseCode}::${offenseDescription}`)

    const shootingValue = String(point.shooting || '').trim().toLowerCase()
    if (shootingValue === '1' || shootingValue === 'y') {
      shootingCount += 1
    }

    const level = Number.isFinite(point.dangerLevel) ? point.dangerLevel : 1
    if (level > maxLevel) {
      maxLevel = level
    }
  })

  return {
    total: cluster.length,
    uniqueOffenses: offenseSet.size,
    shootingCount,
    maxLevel,
  }
}

const buildClusterDetail = cluster => {
  const counts = new Map()
  let maxLevel = 1
  let shootingCount = 0

  cluster.forEach(point => {
    const offenseCode = point.offenseCode || 'N/A'
    const offenseDescription = point.offenseDescription || 'Unknown offense'
    const key = `${offenseCode}::${offenseDescription}`
    counts.set(key, (counts.get(key) || 0) + 1)

    const shootingValue = String(point.shooting || '').trim().toLowerCase()
    if (shootingValue === '1' || shootingValue === 'y') {
      shootingCount += 1
    }

    const level = Number.isFinite(point.dangerLevel) ? point.dangerLevel : 1
    if (level > maxLevel) {
      maxLevel = level
    }
  })

  const topOffenses = Array.from(counts.entries())
    .map(([key, count]) => {
      const [code, description] = key.split('::')
      return { code, description, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, CHICAGO_CLUSTER_TOP_OFFENSE_LIMIT)

  return {
    total: cluster.length,
    uniqueOffenses: counts.size,
    topOffenses,
    shootingCount,
    maxLevel,
  }
}

const buildDetailPayload = summary => ({
  total: summary.total,
  uniqueOffenses: summary.uniqueOffenses,
  topOffenses: summary.topOffenses,
  shootingCount: summary.shootingCount,
  maxLevel: summary.maxLevel,
})

export const handler = async event => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  if (event.queryStringParameters?.detailKey) {
    const detailKeyParam = event.queryStringParameters.detailKey
    const cachedDetail = getCachedEntry(detailCache, detailKeyParam)
    if (cachedDetail) {
      return jsonResponse(200, cachedDetail, {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
        'X-Cache': 'HIT',
      })
    }

    const parsedDetail = parseDetailKey(detailKeyParam)
    if (!parsedDetail) {
      return jsonResponse(400, { error: 'Invalid detailKey.' })
    }
    const cacheParams = parseCacheKey(parsedDetail.cacheKey)
    if (!cacheParams) {
      return jsonResponse(400, { error: 'Invalid detailKey context.' })
    }

    const bounds = normalizeBounds(cacheParams)
    if (!bounds) {
      return jsonResponse(400, { error: 'Invalid detailKey bounds.' })
    }
    const zoom = parseNumber(cacheParams.zoom)
    const dangerLevel = clampDangerLevel(cacheParams.dangerLevel)
    const limit = Math.min(
      Math.max(parseInteger(cacheParams.limit, CHICAGO_VIEW_POINT_LIMIT), 1),
      CHICAGO_VIEW_POINT_LIMIT,
    )

    let points = null
    try {
      points = await fetchChicagoPoints(bounds, limit)
    } catch (error) {
      return jsonResponse(500, { error: 'Failed to load Chicago data.' })
    }

    const visiblePoints = filterPointsInBounds(points, bounds, limit)
    const filteredPoints = visiblePoints.filter(
      point => point.dangerLevel >= dangerLevel,
    )
    if (filteredPoints.length === 0) {
      return jsonResponse(404, { error: 'Cluster detail not found.' })
    }

    const radiusMeters = getChicagoClusterRadiusMeters(zoom)
    const centerLat = (bounds.north + bounds.south) / 2
    const clusters = clusterChicagoPoints(
      filteredPoints,
      radiusMeters,
      centerLat,
    )

    const cluster = clusters[parsedDetail.index]
    if (!cluster) {
      return jsonResponse(404, { error: 'Cluster detail not found.' })
    }

    const summary = buildClusterDetail(cluster)
    const detailPayload = buildDetailPayload(summary)
    setCachedEntry(detailCache, detailKeyParam, detailPayload)
    return jsonResponse(200, detailPayload, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
      'X-Cache': 'MISS',
    })
  }

  const detailIndexParam = event.queryStringParameters?.detailIndex
  if (detailIndexParam !== undefined) {
    const detailIndex = parseInteger(detailIndexParam, null)
    if (!Number.isFinite(detailIndex) || detailIndex < 0) {
      return jsonResponse(400, { error: 'Invalid detailIndex.' })
    }

    const bounds = normalizeBounds(event.queryStringParameters)
    if (!bounds) {
      return jsonResponse(400, {
        error: 'Missing or invalid bounds (north, south, east, west).',
      })
    }

    const zoom = parseNumber(event.queryStringParameters?.zoom)
    const dangerLevel = clampDangerLevel(
      parseInteger(event.queryStringParameters?.dangerLevel, 1),
    )
    const limit = Math.min(
      Math.max(
        parseInteger(
          event.queryStringParameters?.limit,
          CHICAGO_VIEW_POINT_LIMIT,
        ),
        1,
      ),
      CHICAGO_VIEW_POINT_LIMIT,
    )

    const cacheKey = getCacheKey({ bounds, zoom, dangerLevel, limit })
    const detailKey = buildDetailKey(cacheKey, detailIndex)
    const cachedDetail = getCachedEntry(detailCache, detailKey)
    if (cachedDetail) {
      return jsonResponse(200, cachedDetail, {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
        'X-Cache': 'HIT',
      })
    }

    let points = null
    try {
      points = await fetchChicagoPoints(bounds, limit)
    } catch (error) {
      return jsonResponse(500, { error: 'Failed to load Chicago data.' })
    }

    const visiblePoints = filterPointsInBounds(points, bounds, limit)
    const filteredPoints = visiblePoints.filter(
      point => point.dangerLevel >= dangerLevel,
    )
    if (filteredPoints.length === 0) {
      return jsonResponse(404, { error: 'Cluster detail not found.' })
    }

    const radiusMeters = getChicagoClusterRadiusMeters(zoom)
    const centerLat = (bounds.north + bounds.south) / 2
    const clusters = clusterChicagoPoints(
      filteredPoints,
      radiusMeters,
      centerLat,
    )

    const cluster = clusters[detailIndex]
    if (!cluster) {
      return jsonResponse(404, { error: 'Cluster detail not found.' })
    }

    const summary = buildClusterDetail(cluster)
    const detailPayload = buildDetailPayload(summary)
    setCachedEntry(detailCache, detailKey, detailPayload)
    return jsonResponse(200, detailPayload, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
      'X-Cache': 'MISS',
    })
  }

  const bounds = normalizeBounds(event.queryStringParameters)
  if (!bounds) {
    return jsonResponse(400, {
      error: 'Missing or invalid bounds (north, south, east, west).',
    })
  }

  const zoom = parseNumber(event.queryStringParameters?.zoom)
  const dangerLevel = clampDangerLevel(
    parseInteger(event.queryStringParameters?.dangerLevel, 1),
  )
  const limit = Math.min(
    Math.max(
      parseInteger(event.queryStringParameters?.limit, CHICAGO_VIEW_POINT_LIMIT),
      1,
    ),
    CHICAGO_VIEW_POINT_LIMIT,
  )
  const cacheKey = getCacheKey({ bounds, zoom, dangerLevel, limit })
  const cached = getCachedEntry(responseCache, cacheKey)
  if (cached) {
    return jsonResponse(200, cached, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
      'X-Cache': 'HIT',
    })
  }

  let points = null
  try {
    points = await fetchChicagoPoints(bounds, limit)
  } catch (error) {
    return jsonResponse(500, { error: 'Failed to load Chicago data.' })
  }

  const visiblePoints = filterPointsInBounds(points, bounds, limit)
  const filteredPoints = visiblePoints.filter(
    point => point.dangerLevel >= dangerLevel,
  )

  if (filteredPoints.length === 0) {
    const emptyPayload = { clusters: [], maxCount: 0 }
    setCachedEntry(responseCache, cacheKey, emptyPayload)
    return jsonResponse(200, emptyPayload, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
      'X-Cache': 'MISS',
    })
  }

  const radiusMeters = getChicagoClusterRadiusMeters(zoom)
  const centerLat = (bounds.north + bounds.south) / 2
  const clusters = clusterChicagoPoints(filteredPoints, radiusMeters, centerLat)

  const payload = clusters
    .map((cluster, index) => {
      const centroid = getClusterCentroid(cluster)
      const summary = buildClusterAggregates(cluster)
      const detailKey = buildDetailKey(cacheKey, index)
      const polygon = clusterToPolygon(cluster, radiusMeters)
      if (!polygon || polygon.length < 3) {
        return null
      }
      return {
        polygon: polygon.map(roundPoint),
        centroid: roundPoint(centroid),
        summary,
        detailKey,
        count: summary.total,
        maxLevel: summary.maxLevel,
      }
    })
    .filter(Boolean)

  const maxCount =
    payload.length > 0
      ? Math.max(1, ...payload.map(item => item.count))
      : 0

  const responsePayload = {
    clusters: payload,
    maxCount,
    context: {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
      zoom,
      dangerLevel,
      limit,
    },
  }
  setCachedEntry(responseCache, cacheKey, responsePayload)
  return jsonResponse(200, responsePayload, {
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
    'X-Cache': 'MISS',
  })
}
