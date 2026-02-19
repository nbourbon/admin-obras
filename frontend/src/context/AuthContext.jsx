import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await authAPI.me()
      setUser(response.data)
    } catch (error) {
      // Only clear token on auth errors, not on network/cancel errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token')
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await authAPI.login(email, password)
    const { access_token } = response.data
    localStorage.setItem('token', access_token)

    const userResponse = await authAPI.me()
    setUser(userResponse.data)
    return userResponse.data
  }

  const loginWithGoogle = async (credential) => {
    const response = await authAPI.googleLogin(credential)
    const { access_token } = response.data
    localStorage.setItem('token', access_token)
    const userResponse = await authAPI.me()
    setUser(userResponse.data)
    return userResponse.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
