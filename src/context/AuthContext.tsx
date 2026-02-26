
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

interface UserData {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'parent' | 'admin';
  familyId: string;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  joinFamily: (familyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Create a new Family for the new user
          const familyRef = await addDoc(collection(db, 'families'), {
            name: `Familia de ${currentUser.displayName}`,
            members: [currentUser.uid],
            createdAt: serverTimestamp(),
          });

          const newData: UserData = {
            id: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'parent',
            familyId: familyRef.id,
            createdAt: serverTimestamp(),
          };
          await setDoc(userDocRef, newData);
          setUserData(newData);
        } else {
          setUserData(userDoc.data() as UserData);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, db]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo iniciar sesión.",
      });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const joinFamily = async (familyId: string) => {
    if (!user || !userData) return;
    try {
      const familyRef = doc(db, 'families', familyId);
      const familySnap = await getDoc(familyRef);
      
      if (!familySnap.exists()) {
        throw new Error("La familia no existe");
      }

      // 1. Update family members
      await updateDoc(familyRef, {
        members: arrayUnion(user.uid)
      });

      // 2. Update user's familyId
      await updateDoc(doc(db, 'users', user.uid), {
        familyId: familyId
      });

      // 3. Update local state
      setUserData({ ...userData, familyId });
      
      toast({ title: "¡Familia unida!", description: "Ahora compartes perfiles con tu pareja." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, logout, joinFamily }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
