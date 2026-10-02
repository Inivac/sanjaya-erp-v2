import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useApp } from './AppContext.jsx'
import { supabase } from '../utils/supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { users, updateUser } = useApp()
  const [userId, setUserId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState('')

  // Check current session on mount and listen to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
      } else {
        setUserId(null)
        setCurrentUser(null)
      }
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Resolve currentUser profile from fetched public.users list whenever userId or users list updates
  useEffect(() => {
    if (userId) {
      const match = users.find(u => u.id === userId)
      setCurrentUser(match || null)
    } else {
      setCurrentUser(null)
    }
  }, [users, userId])

  const login = useCallback(async (email, password) => {
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (authError) {
      if (authError.message === 'Invalid login credentials') {
        setError('Incorrect password or email. Check the demo credentials.')
      } else {
        setError(authError.message)
      }
      return false
    }

    const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single()
    if (profile) {
      const lastLoginStr = new Date().toLocaleString('en-LK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      let status = profile.status
      if (status === 'Invited') status = 'Active'
      
      await supabase.from('users').update({ status, last_login: lastLoginStr }).eq('id', data.user.id)
      updateUser(data.user.id, { status, lastLogin: lastLoginStr })
    }

    setUserId(data.user.id)
    return true
  }, [updateUser])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUserId(null)
    setCurrentUser(null)
  }, [])

  const value = { currentUser, isAuthenticated: !!userId, authLoading, login, logout, error, setError }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

