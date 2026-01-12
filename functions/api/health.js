// GET /api/health - Health check

export async function onRequestGet() {
  return Response.json({ status: 'ok', version: '2.0-pages' });
}
