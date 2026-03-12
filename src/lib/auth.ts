import { cookies } from 'next/headers'

const AUTH_COOKIE = 'gc_auth_token'
const AUTH_VALUE = 'authenticated'

export function isAuthenticated(): boolean {
  const cookieStore = cookies()
  const token = cookieStore.get(AUTH_COOKIE)
  return token?.value === AUTH_VALUE
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE
}

export function getAuthCookieValue(): string {
  return AUTH_VALUE
}
