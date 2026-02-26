
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
import { normalizeString } from '@/lib/utils/string';

interface UserData {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'padre' | 'madre';
  isAdmin: boolean;
  familyId: string;
  createdAt: any;
}

interface FamilyData {
  id: string;
  name: string;
  searchName: string;
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserData(null);
        setFamilyData(null);
        setFamilyMembers([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(
      userDocRef, 
      (snap) => {
        if (snap.exists()) {
          setUserData(snap.data() as UserData);
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      async (err) => {
        if (auth.currentUser) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get'
          }));
        }
        setLoading(false);
      }
    );

    return () => unsubUser();
  }, [db, user, auth]);

  useEffect(() => {
    if (!userData?.familyId || !user) {
      setFamilyData(null);
      setFamilyMembers([]);
      return;
    }

    const familyDocRef = doc(db, 'families', userData.familyId);
    const unsubFamily = onSnapshot(
      familyDocRef, 
      (snap) => {
        if (snap.exists()) {
          setFamilyData({ id: snap.id, ...snap.data() } as FamilyData);
        }
      },
      async (err) => {
        if (auth.currentUser) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: familyDocRef.path,
            operation: 'get'
          }));
        }
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
        if (auth.currentUser) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'users',
            operation: 'list'
          }));
        }
      }
    );

    return () => {
      unsubFamily();
      unsubMembers();
    };
  }, [db, userData?.familyId, user, auth]);

  const login = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setLoading(false);
      toast({ variant: "destructive", title: "Error", description: "No se pudo iniciar sesión." });
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setUserData(null);
      setFamilyData(null);
      setFamilyMembers([]);
      await signOut(auth);
    } catch (error) {
      // Handled globally
    } finally {
      setLoading(false);
    }
  };

  const createFamily = async (name: string, role: 'padre' | 'madre') => {
    if (!user) return;
    try {
      setLoading(true);
      const familyRef = await addDoc(collection(db, 'families'), {
        name: `Familia ${name}`,
        searchName: normalizeString(name),
        members: [user.uid],
        createdAt: serverTimestamp(),
      });

      const newUser: UserData = {
        id: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: role,
        isAdmin: false,
        familyId: familyRef.id,
        createdAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'users', user.uid), newUser);
      toast({ 
        title: "¡Familia Creada!", 
        description: `Bienvenidos, Familia ${name}` 
      });
    } catch (error: any) {
      setLoading(false);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'users/' + user.uid,
        operation: 'write'
      }));
    }
  };

  const updateFamilyName = async (newName: string) => {
    if (!userData?.familyId) return;
    // Extraemos apellidos si viene con el prefijo "Familia " para el searchName
    const surnames = newName.startsWith('Familia ') ? newName.replace('Familia ', '') : newName;
    
    updateDoc(doc(db, 'families', userData.familyId), { 
      name: newName,
      searchName: normalizeString(surnames)
    })
      .then(() => {
        toast({ title: "Nombre actualizado", description: `Ahora sois la ${newName}` });
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'families/' + userData.familyId,
          operation: 'update',
          requestResourceData: { name: newName }
        }));
      });
  };

  const joinFamily = async (familyId: string, role: 'padre' | 'madre') => {
    if (!user) return;
    setLoading(true);
    const familyRef = doc(db, 'families', familyId.trim());
    
    getDoc(familyRef)
      .then(async (familySnap) => {
        if (!familySnap.exists()) {
          setLoading(false);
          toast({ variant: "destructive", title: "Error", description: "El código de familia no es válido." });
          return;
        }

        const newUser: UserData = {
          id: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          role: role,
          isAdmin: false,
          familyId: familyId.trim(),
          createdAt: serverTimestamp(),
        };

        try {
          await updateDoc(familyRef, { members: arrayUnion(user.uid) });
          await setDoc(doc(db, 'users', user.uid), newUser);
          toast({ title: "¡Perfil unido!", description: "Ahora compartes perfiles con tu familia." });
        } catch (e) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: familyRef.path,
            operation: 'update'
          }));
        }
      })
      .catch((error) => {
        setLoading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: familyRef.path,
          operation: 'get'
        }));
      });
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
