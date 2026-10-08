import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../api/client.js';
import useDbWrites from '../hooks/useDbWrites.js';

const AuthContext = createContext(null);

// user: the signed-in Student (with credibility_score from the view) or null.
// status: 'loading' until the stored session has been checked.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(auth.sessionId() ? 'loading' : 'ready');

  useEffect(() => {
    if (!auth.sessionId()) return;
    auth.currentUser({ background: true }).then(
      (u) => {
        setUser(u);
        setStatus('ready');
      },
      () => setStatus('ready')
    );
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await auth.currentUser({ background: true });
    setUser(u);
    return u;
  }, []);

  // A new rating on one of my materials changes my credibility — re-read it.
  useDbWrites(() => {
    if (user) refreshUser();
  }, ['Rating', 'Student']);

  const login = useCallback(async (email, password, opts) => {
    const u = await auth.login(email, password, opts);
    setUser(u);
    return u;
  }, []);

  const loginAs = useCallback(async (studentId) => {
    const u = await auth.loginAs(studentId);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (input) => {
    const u = await auth.register(input);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, status, login, loginAs, register, logout, refreshUser }), [user, status, login, loginAs, register, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
