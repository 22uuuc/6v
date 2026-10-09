// EXPORTS: IAuthState, AuthContext, useAuth

import { createContext, useContext } from 'react';
import type { IUser } from '@/lib/types';

export interface IAuthState {
  user: IUser | null;
}

export const AuthContext = createContext<IAuthState>({ user: null });

export function useAuth(): IAuthState {
  return useContext(AuthContext);
}
