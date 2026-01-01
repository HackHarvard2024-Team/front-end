const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 5000

const parseLimit = value => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

export const handler = async event => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const limit =
    parseLimit(event.queryStringParameters?.limit) ?? DEFAULT_LIMIT

  const url = new URL('https://data.cityofnewyork.us/resource/5uac-w243.json')
  url.searchParams.set('$select', 'latitude,longitude,x_coord_cd,y_coord_cd')
  url.searchParams.set(
    '$where',
    "latitude IS NOT NULL AND longitude IS NOT NULL AND cmplnt_fr_dt >= '2023-01-01T00:00:00.000'",
  )
  url.searchParams.set('$limit', String(limit))

  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN
  if (appToken) {
    url.searchParams.set('$$app_token', appToken)
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })

  let data = null
  try {
    data = await response.json()
  } catch (error) {
    data = { error: 'Invalid response from NYC Open Data.' }
  }

  return jsonResponse(response.status, data)
}
