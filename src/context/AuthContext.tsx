
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, updateDoc, arrayUnion, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UserData {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'padre' | 'madre' | 'admin';
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
  joinFamily: (familyId: string, role: 'padre' | 'madre') => Promise<void>;
  createFamily: (name: string, role: 'padre' | 'madre') => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubUser = onSnapshot(
          userDocRef, 
          (snap) => {
            if (snap.exists()) {
              setUserData(snap.data() as UserData);
            } else {
              setUserData(null);
            }
          },
          async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get'
            }));
          }
        );
        return () => unsubUser();
      } else {
        setUser(null);
        setUserData(null);
        setFamilyData(null);
        setFamilyMembers([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, db]);

  useEffect(() => {
    if (!userData?.familyId) {
      setFamilyData(null);
      setFamilyMembers([]);
      if (user && userData === null) setLoading(false);
      return;
    }

    setLoading(true);
    
    const familyDocRef = doc(db, 'families', userData.familyId);
    const unsubFamily = onSnapshot(
      familyDocRef, 
      (snap) => {
        if (snap.exists()) {
          setFamilyData({ id: snap.id, ...snap.data() } as FamilyData);
        }
        setLoading(false);
      },
      async (err) => {
        setLoading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: familyDocRef.path,
          operation: 'get'
        }));
      }
    );

    const membersQuery = query(collection(db, 'users'), where('familyId', '==', userData.familyId));
    const unsubMembers = onSnapshot(
      membersQuery, 
      (snap) => {
        const members: UserData[] = [];
        snap.forEach(doc => members.push(doc.data() as UserData));
        setFamilyMembers(members);
      },
      async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'users',
          operation: 'list'
        }));
      }
    );

    return () => {
      unsubFamily();
      unsubMembers();
    };
  }, [db, userData?.familyId, user]);

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

  const createFamily = async (name: string, role: 'padre' | 'madre') => {
    if (!user) return;
    try {
      const familyRef = await addDoc(collection(db, 'families'), {
        name: `Familia ${name}`,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });

      const newUser: UserData = {
        id: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: role,
        familyId: familyRef.id,
        createdAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'users', user.uid), newUser);
      toast({ title: "¡Familia Creada!", description: `Bienvenidos, Familia ${name}` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear la familia." });
    }
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

  const joinFamily = async (familyId: string, role: 'padre' | 'madre') => {
    if (!user) return;
    try {
      const familyRef = doc(db, 'families', familyId.trim());
      const familySnap = await getDoc(familyRef);
      
      if (!familySnap.exists()) {
        throw new Error("El código de familia no es válido.");
      }

      const newUser: UserData = {
        id: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: role,
        familyId: familyId.trim(),
        createdAt: serverTimestamp(),
      };

      await updateDoc(familyRef, { members: arrayUnion(user.uid) });
      await setDoc(doc(db, 'users', user.uid), newUser);
      toast({ title: "¡Familia unida!", description: "Ahora compartes perfiles con tu pareja." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, familyData, familyMembers, loading, login, logout, joinFamily, createFamily, updateFamilyName }}>
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
