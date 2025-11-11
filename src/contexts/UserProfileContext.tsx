/**
 * USER PROFILE CONTEXT
 *
 * PURPOSE:
 * - Manage user profile data across the application
 * - Persist profile data to localStorage
 * - Provide personalization context for AI responses
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserProfile {
  name: string;
  isStudent: boolean;
  jobTitle: string;
  description: string;
}

interface UserProfileContextType {
  profile: UserProfile;
  updateProfile: (profile: UserProfile) => void;
  hasProfile: boolean;
}

const defaultProfile: UserProfile = {
  name: '',
  isStudent: false,
  jobTitle: '',
  description: '',
};

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

const STORAGE_KEY = 'jcil-user-profile';

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [hasProfile, setHasProfile] = useState(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedProfile = JSON.parse(stored) as UserProfile;
        setProfile(parsedProfile);
        setHasProfile(!!parsedProfile.name);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }, []);

  const updateProfile = (newProfile: UserProfile) => {
    try {
      setProfile(newProfile);
      setHasProfile(!!newProfile.name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  return (
    <UserProfileContext.Provider value={{ profile, updateProfile, hasProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
}
