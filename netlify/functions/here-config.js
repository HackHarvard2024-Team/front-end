const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

export const handler = async event => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) {
    return jsonResponse(500, { error: 'Missing HERE_API_KEY' })
  }

  return jsonResponse(200, { apiKey })
}
