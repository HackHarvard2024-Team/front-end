const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

const parseLimit = value => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.min(parsed, 10)
}

export const handler = async event => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) {
    return jsonResponse(500, { error: 'Missing HERE_API_KEY' })
  }

  const query = event.queryStringParameters?.q
  if (!query) {
    return jsonResponse(400, { error: 'Missing query parameter: q' })
  }

  const url = new URL('https://geocode.search.hereapi.com/v1/geocode')
  url.searchParams.set('q', query)
  url.searchParams.set('apiKey', apiKey)

  const limit = parseLimit(event.queryStringParameters?.limit)
  if (limit) {
    url.searchParams.set('limit', String(limit))
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })

  let data = null
  try {
    data = await response.json()
  } catch (error) {
    data = { error: 'Invalid response from HERE geocoding.' }
  }

  return jsonResponse(response.status, data)
}
