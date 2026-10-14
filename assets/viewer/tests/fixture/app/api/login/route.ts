// Static review fixture only. The external identity service is unavailable.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return Response.json({ error: 'Missing credentials' }, { status: 400 });
    }
    const identity = await fetch('https://identity.example.test/check', {
      method: 'POST', body: JSON.stringify(body),
    });
    if (!identity.ok) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    return Response.json({ authenticated: true });
  } catch {
    return Response.json({ error: 'Identity provider unavailable' }, { status: 503 });
  }
}
