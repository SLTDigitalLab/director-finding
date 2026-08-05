import { ENABLE_AUTH } from './constants'

export function getStoredUser() {
  if (!ENABLE_AUTH) return null
  const storedUser = sessionStorage.getItem('azureUser')
  if (!storedUser) return null
  try {
    return JSON.parse(storedUser)
  } catch {
    return null
  }
}

export function buildAuthUrl() {
  const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID
  const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID
  const REDIRECT_URI = `${window.location.origin}/login`

  if (!CLIENT_ID || !TENANT_ID) return null

  const nonce = Math.random().toString(36).substring(7)
  const state = Math.random().toString(36).substring(7)
  sessionStorage.setItem('auth_state', state)

  const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`
  return (
    `${AUTHORITY}/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent('User.Read')}` +
    `&response_mode=fragment` +
    `&state=${state}` +
    `&nonce=${nonce}`
  )
}

export async function handleAuthRedirect() {
  const hash = window.location.hash
  if (!hash) return null

  const params = new URLSearchParams(hash.substring(1))
  const accessToken = params.get('access_token')
  const errorParam = params.get('error')

  if (errorParam) {
    console.error(
      'Authentication error:',
      params.get('error_description') || errorParam
    )
    window.history.replaceState({}, document.title, window.location.pathname)
    return null
  }

  if (!accessToken) return null

  sessionStorage.setItem('azureToken', accessToken)
  window.history.replaceState({}, document.title, window.location.pathname)

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const userData = await response.json()
    const userInfo = {
      name: userData.displayName,
      email: userData.mail || userData.userPrincipalName,
      id: userData.id,
    }
    sessionStorage.setItem('azureUser', JSON.stringify(userInfo))
    return userInfo
  } catch (err) {
    console.error('Error fetching user profile:', err)
    return null
  }
}

export function logout() {
  sessionStorage.removeItem('azureUser')
  sessionStorage.removeItem('azureToken')
}