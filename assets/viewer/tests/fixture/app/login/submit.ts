// Static review fixture only; this file is never executed by the skill.
export async function submitLogin(email: string, password: string) {
  if (!email || !password) return { screen: 'validation-error' };
  try {
    const response = await fetch('/api/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return { screen: 'login-error' };
    return { screen: 'dashboard' };
  } catch {
    return { screen: 'network-error' };
  }
}
