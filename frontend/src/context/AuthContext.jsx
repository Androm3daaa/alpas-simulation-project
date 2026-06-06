import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('alpas_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = (email, password) => {
    // In a real app, this would call an API.
    // For now we do mock authentication.
    const users = JSON.parse(localStorage.getItem('alpas_users') || '[]');

    const identifier = email.toLowerCase();

    const foundUser = users.find(u =>
      u.email?.toLowerCase() === identifier ||
      u.username?.toLowerCase() === identifier
    );

    if (!foundUser) {
      return { success: false, error: 'No account found with this username or email.' };
    }

    // Very basic password check (demo only)
    if (foundUser.password !== password) {
      return { success: false, error: 'Incorrect password.' };
    }

    const userSession = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role || 'researcher',
      institution: foundUser.institution || 'University of the Philippines',
    };

    setUser(userSession);
    localStorage.setItem('alpas_user', JSON.stringify(userSession));

    return { success: true };
  };

  // Register function
  const register = (name, email, password, institution = '') => {
    const users = JSON.parse(localStorage.getItem('alpas_users') || '[]');

    const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const newUser = {
      id: 'user_' + Date.now(),
      name: name.trim(),
      email: email.toLowerCase(),
      password, // Note: In production, never store plain passwords!
      institution: institution.trim() || 'Independent Researcher',
      role: 'researcher',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem('alpas_users', JSON.stringify(users));

    // Auto-login after registration
    const userSession = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      institution: newUser.institution,
    };

    setUser(userSession);
    localStorage.setItem('alpas_user', JSON.stringify(userSession));

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('alpas_user');
  };

  // Seed default accounts (admin + demo)
  const ensureDefaultAccounts = () => {
    const users = JSON.parse(localStorage.getItem('alpas_users') || '[]');

    // Admin account - username: admin, password: admin
    const hasAdmin = users.some(u => u.username === 'admin' || u.email === 'admin@alpas.edu');
    if (!hasAdmin) {
      users.push({
        id: 'admin_001',
        username: 'admin',
        name: 'Administrator',
        email: 'admin@alpas.edu',
        password: 'admin',
        institution: 'ALPAS System',
        role: 'admin',
      });
    }

    // Demo researcher account
    const hasDemo = users.some(u => u.email === 'demo@alpas.edu');
    if (!hasDemo) {
      users.push({
        id: 'demo_001',
        name: 'Alex Rivera',
        email: 'demo@alpas.edu',
        password: 'demo123',
        institution: 'National Institute of Fire Safety',
        role: 'safety_engineer',
      });
    }

    localStorage.setItem('alpas_users', JSON.stringify(users));
  };

  // Keep old name for backward compatibility
  const ensureDemoAccount = () => ensureDefaultAccounts();

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    ensureDemoAccount,
    ensureDefaultAccounts,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
