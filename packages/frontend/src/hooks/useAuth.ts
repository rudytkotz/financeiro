import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'

export interface AuthUser {
  id: string
  username: string
  isAdmin: boolean
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('auth_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { username, password })
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    setUser(data.user)
    // Clear all cached data from previous user
    queryClient.clear()
    return data.user
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const { data } = await api.post('/api/auth/register', { username, password })
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    setUser(data.user)
    queryClient.clear()
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setUser(null)
    queryClient.clear()
  }, [])

  return { user, login, register, logout, isAuthenticated: !!user }
}
