
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, updateDoc, arrayUnion, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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

interface FamilyData {
  id: string;
  name: string;
  members: string[];
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  familyData: FamilyData | null;
  familyMembers: UserData[];
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  joinFamily: (familyId: string) => Promise<void>;
  updateFamilyName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [familyMembers, setFamilyMembers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync family and members in real-time
  useEffect(() => {
    if (!userData?.familyId) {
      setFamilyData(null);
      setFamilyMembers([]);
      return;
    }

    // Listen to Family changes
    const unsubFamily = onSnapshot(doc(db, 'families', userData.familyId), (snap) => {
      if (snap.exists()) {
        setFamilyData({ id: snap.id, ...snap.data() } as FamilyData);
      }
    });

    // Listen to Family Members
    const membersQuery = query(collection(db, 'users'), where('familyId', '==', userData.familyId));
    const unsubMembers = onSnapshot(membersQuery, (snap) => {
      const members: UserData[] = [];
      snap.forEach(doc => members.push(doc.data() as UserData));
      setFamilyMembers(members);
    });

    return () => {
      unsubFamily();
      unsubMembers();
    };
  }, [db, userData?.familyId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const familyRef = await addDoc(collection(db, 'families'), {
            name: `Familia de ${currentUser.displayName?.split(' ')[0]}`,
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
          const data = userDoc.data() as UserData;
          // Refresh profile if needed
          if (data.photoURL !== currentUser.photoURL || data.displayName !== currentUser.displayName) {
            await updateDoc(userDocRef, {
              photoURL: currentUser.photoURL,
              displayName: currentUser.displayName
            });
            setUserData({ ...data, photoURL: currentUser.photoURL, displayName: currentUser.displayName });
          } else {
            setUserData(data);
          }
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
      toast({ variant: "destructive", title: "Error", description: "No se pudo iniciar sesión." });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateFamilyName = async (newName: string) => {
    if (!userData?.familyId) return;
    try {
      await updateDoc(doc(db, 'families', userData.familyId), { name: newName });
      toast({ title: "Nombre actualizado", description: `Ahora sois la ${newName}` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el nombre." });
    }
  };

  const joinFamily = async (familyId: string) => {
    if (!user || !userData) return;
    try {
      const familyRef = doc(db, 'families', familyId);
      const familySnap = await getDoc(familyRef);
      
      if (!familySnap.exists()) {
        throw new Error("El código de familia no es válido.");
      }

      await updateDoc(familyRef, { members: arrayUnion(user.uid) });
      await updateDoc(doc(db, 'users', user.uid), { familyId: familyId });
      setUserData({ ...userData, familyId });
      toast({ title: "¡Familia unida!", description: "Ahora compartes perfiles con tu pareja." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, familyData, familyMembers, loading, login, logout, joinFamily, updateFamilyName }}>
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
