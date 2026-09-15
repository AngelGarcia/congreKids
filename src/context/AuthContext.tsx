
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence
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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
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
      // Forzamos persistencia local para evitar problemas con sessionStorage en navegadores con ITP (Safari/Brave)
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      // Configuramos parámetros para intentar reducir bloqueos de popups
      provider.setCustomParameters({ prompt: 'select_account' });
      
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setLoading(false);
      console.error("Auth Error:", error);
      
      let message = "No se pudo iniciar sesión con Google.";
      if (error.code === 'auth/popup-blocked') {
        message = "El navegador bloqueó la ventana emergente. Por favor, permítela e inténtalo de nuevo.";
      } else if (error.code === 'auth/web-storage-unsupported' || error.message?.includes('missing initial state')) {
        message = "Tu navegador está bloqueando las cookies necesarias. Intenta desactivar el 'Bloqueo de rastreo' o usa otro navegador.";
      }
      
      toast({ 
        variant: "destructive", 
        title: "Error de Autenticación", 
        description: message 
      });
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setLoading(false);
      let message = "Email o contraseña incorrectos.";
      if (error.code === 'auth/invalid-credential') message = "Credenciales inválidas.";
      if (error.code === 'auth/user-not-found') message = "El usuario no existe.";
      toast({ variant: "destructive", title: "Error de acceso", description: message });
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
    } catch (error: any) {
      setLoading(false);
      let message = "No se pudo crear la cuenta.";
      if (error.code === 'auth/email-already-in-use') message = "Este email ya está en uso.";
      if (error.code === 'auth/weak-password') message = "La contraseña es muy débil.";
      toast({ variant: "destructive", title: "Error de registro", description: message });
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
          // CRITICAL: Primero guardamos el usuario con su familyId para que la regla de seguridad
          // de Firestore 'isFamilyMember(familyId)' se cumpla al intentar actualizar el documento de la familia.
          await setDoc(doc(db, 'users', user.uid), newUser);
          await updateDoc(familyRef, { members: arrayUnion(user.uid) });
          toast({ title: "¡Perfil unido!", description: "Ahora compartes perfiles con tu familia." });
        } catch (e) {
          setLoading(false);
          toast({ variant: "destructive", title: "Error de unión", description: "No se pudo actualizar los miembros de la familia." });
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: familyRef.path,
            operation: 'update'
          }));
        }
      })
      .catch((error) => {
        setLoading(false);
        toast({ variant: "destructive", title: "Error", description: "No se pudo obtener la información de la familia." });
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: familyRef.path,
          operation: 'get'
        }));
      });
  };

  return (
    <AuthContext.Provider value={{ user, userData, familyData, familyMembers, loading, login, loginWithEmail, signUpWithEmail, logout, joinFamily, createFamily, updateFamilyName }}>
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
