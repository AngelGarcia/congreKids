
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar as CalendarIcon, AlertCircle, Baby, Users, ArrowRight, UserPlus, Loader2, Music, CheckCircle2, Lock, LogOut, ChevronLeft, Mail, Key, User as UserIcon } from 'lucide-react';
import { collection, query, where, orderBy, limit, doc, Timestamp, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDate, formatDateTime, isRegistrationOpen, calculateAgeInMonths, getRegistrationOpeningDate } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';
import { normalizeString, cleanSurnames } from '@/lib/utils/string';
import { Switch } from '@/components/ui/switch';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

/**
 * Ayudante visual para el icono del niño en inscripciones (Bebé universal con color).
 */
function ChildIconHelper({ gender }: { gender: string }) {
  const isGirl = gender === 'niña';
  return (
    <div className={cn(
      "w-full h-full rounded-full flex items-center justify-center border-2",
      isGirl ? "bg-pink-100 text-pink-500 border-pink-200" : "bg-blue-100 text-blue-500 border-blue-200"
    )}>
      <Baby className="w-4 h-4" />
    </div>
  );
}

export default function ParentDashboard() {
  const { user, userData, familyData, login, loginWithEmail, signUpWithEmail, joinFamily, createFamily, logout, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  // UI State
  const [selectedRole, setSelectedRole] = useState<'padre' | 'madre'>('padre');
  const [step, setStep] = useState<'role' | 'search' | 'confirm'>('role');
  const [authMode, setAuthMode] = useState<'options' | 'email-login' | 'email-register'>('options');
  
  // Forms state
  const [familySurnames, setFamilySurnames] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundFamilies, setFoundFamilies] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [guitarSelections, setGuitarSelections] = useState<Record<string, boolean>>({});

  // Email Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const childrenQuery = useMemoFirebase(() => {
    if (!db || !userData?.familyId || !user) return null;
    return collection(db, 'families', userData.familyId, 'children');
  }, [db, userData?.familyId, user]);

  const upcomingMeetingsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    const now = new Date();
    return query(
      collection(db, 'meetings'), 
      where('date', '>=', Timestamp.fromDate(now)), 
      orderBy('date', 'asc'), 
      limit(1)
    );
  }, [db, user]);

  const { data: children, isLoading: loadingChildren } = useCollection(childrenQuery);
  const { data: upcomingMeetings, isLoading: loadingMeetings } = useCollection(upcomingMeetingsQuery);
  const upcomingMeeting = upcomingMeetings?.[0] || null;

  const sortedChildren = children ? [...children].sort((a, b) => {
    const dateA = a.birthDate instanceof Date ? a.birthDate : (a.birthDate as any).toDate();
    const dateB = b.birthDate instanceof Date ? b.birthDate : (b.birthDate as any).toDate();
    return dateA.getTime() - dateB.getTime();
  }) : [];

  const registrationRef = useMemoFirebase(() => {
    if (!db || !upcomingMeeting || !userData?.familyId || !user) return null;
    return doc(db, 'meetings', upcomingMeeting.id, 'registrations', userData.familyId);
  }, [db, upcomingMeeting, userData?.familyId, user]);

  const { data: registration } = useDoc(registrationRef);

  useEffect(() => {
    if (registration && registration.children) {
      setSelectedChildren(registration.children.map((c: any) => c.childId));
      const gS: Record<string, boolean> = {};
      registration.children.forEach((c: any) => {
        if (c.guitarSelected) gS[c.childId] = true;
      });
      setGuitarSelections(gS);
    }
  }, [registration]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'email-login') {
      loginWithEmail(email, password);
    } else {
      signUpWithEmail(email, password, displayName);
    }
  };

  const handleSearchFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familySurnames.trim()) return;

    setIsSearching(true);
    try {
      const surnames = cleanSurnames(familySurnames);
      const normalizedSearch = normalizeString(surnames);
      
      const qNormalized = query(
        collection(db, 'families'), 
        where('searchName', '>=', normalizedSearch),
        where('searchName', '<=', normalizedSearch + '\uf8ff'),
        limit(5)
      );

      const qDirect = query(
        collection(db, 'families'),
        where('name', '>=', familySurnames),
        where('name', '<=', familySurnames + '\uf8ff'),
        limit(5)
      );

      const qPrefix = query(
        collection(db, 'families'),
        where('name', '>=', 'Familia ' + familySurnames),
        where('name', '<=', 'Familia ' + familySurnames + '\uf8ff'),
        limit(5)
      );
      
      const [snap1, snap2, snap3] = await Promise.all([
        getDocs(qNormalized),
        getDocs(qDirect),
        getDocs(qPrefix)
      ]);

      const resultsMap = new Map();
      [...snap1.docs, ...snap2.docs, ...snap3.docs].forEach(docSnap => {
        resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });

      const uniqueFamilies = Array.from(resultsMap.values());
      
      if (uniqueFamilies.length > 0) {
        const familiesWithMembers = await Promise.all(uniqueFamilies.map(async (famData) => {
          let members: any[] = [];
          try {
            const mQ = query(collection(db, 'users'), where('familyId', '==', famData.id));
            const mSnap = await getDocs(mQ);
            members = mSnap.docs.map(d => d.data());
          } catch (err) {
            console.warn("Could not fetch family members for search preview", err);
          }
          return { ...famData, membersList: members };
        }));
        setFoundFamilies(familiesWithMembers);
      } else {
        setFoundFamilies([]);
      }
      setStep('confirm');
    } catch (err: any) {
      console.error("Error completo de búsqueda:", err);
      const contextualError = new FirestorePermissionError({
        path: 'families',
        operation: 'list',
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegister = () => {
    if (!user || !upcomingMeeting || !userData || !registrationRef) return;

    const meetingDate = (upcomingMeeting.date as any).toDate();
    const childrenToRegister = (children || [])
      .filter(c => selectedChildren.includes(c.id))
      .map(c => {
        const ageMonths = calculateAgeInMonths((c.birthDate as any).toDate(), meetingDate);
        const group = upcomingMeeting.ageGroups.find((g: any) => {
          return ageMonths >= g.minMonths && ageMonths < g.maxMonths;
        });
        
        const groupLabel = group ? group.label : "Sin grupo";

        return {
          childId: c.id,
          name: c.name,
          birthDate: c.birthDate,
          gender: c.gender || 'niño',
          ageGroupLabel: groupLabel,
          guitarSelected: !!guitarSelections[c.id]
        };
      });

    setDocumentNonBlocking(registrationRef, {
      meetingId: upcomingMeeting.id,
      familyId: userData.familyId,
      familyName: familyData?.name || '',
      registeredBy: user.uid,
      parentName: user.displayName,
      parentEmail: user.email,
      children: childrenToRegister,
      registeredAt: registration?.registeredAt || Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    }, { merge: true });

    toast({ 
      title: "Inscripción guardada", 
      description: `Los datos se han sincronizado con tu familia.` 
    });
  };

  const toggleGuitar = (childId: string) => {
    setGuitarSelections(prev => ({
      ...prev,
      [childId]: !prev[childId]
    }));
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black text-primary text-2xl uppercase tracking-tighter">Cargando CongreKids...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8 shadow-inner">
          <Baby className="w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black text-primary tracking-tighter mb-4 uppercase">CongreKids</h1>
        <p className="text-xl text-muted-foreground max-w-sm mb-12 font-medium">Gestión inteligente de cuidado infantil para congregaciones.</p>
        
        <Card className="w-full max-w-sm rounded-[2.5rem] shadow-2xl border-none overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <CardHeader className="bg-primary/5 p-8 pb-4">
            <CardTitle className="text-xl font-black uppercase tracking-tighter">Acceso de Padres</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {authMode === 'options' ? (
              <div className="space-y-4">
                <Button size="lg" onClick={login} className="w-full h-16 text-lg rounded-2xl shadow-lg font-black bg-white text-primary border-2 border-primary/20 hover:bg-primary/5 transition-all">
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </Button>
                
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-3 text-muted-foreground">O usa tu email</span></div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button variant="outline" onClick={() => setAuthMode('email-login')} className="h-14 rounded-xl font-black uppercase tracking-widest text-xs border-2">
                    <Mail className="w-4 h-4 mr-2" /> Iniciar Sesión
                  </Button>
                  <Button variant="ghost" onClick={() => setAuthMode('email-register')} className="h-10 rounded-xl font-black uppercase tracking-widest text-[9px] text-muted-foreground hover:text-primary">
                    <UserPlus className="w-3.5 h-3.5 mr-2" /> Crear cuenta nueva
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                {authMode === 'email-register' && (
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Ej. Juan Pérez" 
                        value={displayName} 
                        onChange={e => setDisplayName(e.target.value)}
                        required
                        className="h-12 pl-11 rounded-xl border-2 font-bold"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2 text-left">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="nombre@ejemplo.com" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="h-12 pl-11 rounded-xl border-2 font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-left">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contraseña</Label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="h-12 pl-11 rounded-xl border-2 font-bold"
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full h-14 rounded-xl font-black uppercase tracking-tighter text-lg shadow-lg mt-2">
                  {authMode === 'email-login' ? 'Entrar' : 'Registrarme'}
                </Button>
                
                <Button variant="ghost" onClick={() => setAuthMode('options')} className="w-full h-10 rounded-xl font-black uppercase tracking-widest text-[9px] text-muted-foreground">
                  <ChevronLeft className="w-3 h-3 mr-1" /> Volver a opciones
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userData?.familyId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
            <CardHeader className="text-center space-y-2 bg-primary/5 p-10 pb-8">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary mx-auto mb-4 shadow-sm border">
                <Users className="w-8 h-8" />
              </div>
              <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-none">Bienvenido</CardTitle>
              <CardDescription className="text-base font-bold text-muted-foreground">Configura tu unidad familiar para empezar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-10 pt-8 pb-4">
              {step === 'role' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <Label className="text-xs font-black uppercase text-primary tracking-widest block text-center">Primero, ¿cuál es tu rol?</Label>
                  <RadioGroup value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)} className="flex gap-4">
                    <div className="flex-1">
                      <RadioGroupItem value="padre" id="padre" className="sr-only" />
                      <Label
                        htmlFor="padre"
                        className={cn(
                          "flex flex-col items-center justify-center h-28 rounded-3xl border-2 transition-all cursor-pointer font-black text-lg uppercase",
                          selectedRole === 'padre' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-muted bg-popover hover:bg-accent"
                        )}
                      >
                        Padre
                      </Label>
                    </div>
                    <div className="flex-1">
                      <RadioGroupItem value="madre" id="madre" className="sr-only" />
                      <Label
                        htmlFor="madre"
                        className={cn(
                          "flex flex-col items-center justify-center h-28 rounded-3xl border-2 transition-all cursor-pointer font-black text-lg uppercase",
                          selectedRole === 'madre' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-muted bg-popover hover:bg-accent"
                        )}
                      >
                        Madre
                      </Label>
                    </div>
                  </RadioGroup>
                  <Button onClick={() => setStep('search')} className="w-full h-16 rounded-2xl font-black text-xl shadow-xl uppercase tracking-tighter">Continuar</Button>
                </div>
              )}
              {step === 'search' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <form onSubmit={handleSearchFamily} className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-primary tracking-widest block text-center">Apellidos de tu Familia</Label>
                      <Input 
                        placeholder="Ej. López Pardo" 
                        value={familySurnames}
                        onChange={e => setFamilySurnames(e.target.value)}
                        required
                        className="h-16 rounded-2xl border-2 font-black text-center text-xl shadow-inner bg-muted/20"
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button type="submit" disabled={isSearching} className="h-16 rounded-2xl font-black text-xl shadow-xl uppercase tracking-tighter">
                        {isSearching ? <Loader2 className="animate-spin w-6 h-6" /> : 'Buscar Familia'}
                      </Button>
                      <Button variant="ghost" onClick={() => setStep('role')} className="h-10 rounded-xl font-black uppercase text-xs text-muted-foreground">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Volver
                      </Button>
                    </div>
                  </form>
                </div>
              )}
              {step === 'confirm' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  {foundFamilies.length > 0 ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-xs font-black uppercase text-primary tracking-widest italic mb-4">¿Alguna de estas es tu familia?</p>
                        <div className="space-y-3">
                          {foundFamilies.map((fam) => (
                            <div key={fam.id} className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/20 text-left hover:bg-primary/10 transition-colors shadow-sm">
                              <h3 className="text-xl font-black uppercase tracking-tighter leading-none mb-3">{fam.name}</h3>
                              <div className="flex items-center justify-between">
                                <div className="flex -space-x-2 overflow-hidden">
                                  {fam.membersList && fam.membersList.map((m: any, i: number) => (
                                    <div key={i} className="inline-block h-8 w-8 rounded-full border-2 border-white bg-primary text-[10px] text-white flex items-center justify-center font-black uppercase shadow-sm">
                                      {m.displayName?.[0]}
                                    </div>
                                  ))}
                                  {(!fam.membersList || fam.membersList.length === 0) && (
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">Sin miembros visibles</span>
                                  )}
                                </div>
                                <Button size="sm" onClick={() => joinFamily(fam.id, selectedRole)} className="rounded-xl h-10 px-6 font-black uppercase text-xs shadow-md">UNIRME</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><Separator className="w-full border-dashed" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-3 text-muted-foreground">O también puedes</span></div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <Button variant="outline" onClick={() => createFamily(familySurnames, selectedRole)} className="w-full h-16 rounded-2xl font-black text-sm uppercase border-2 border-primary text-primary hover:bg-primary/5 shadow-sm">
                          CREAR NUEVA FAMILIA {familySurnames.toUpperCase()}
                        </Button>
                        <Button variant="ghost" onClick={() => setStep('search')} className="h-10 rounded-xl font-black uppercase text-[10px] text-muted-foreground">
                          <ChevronLeft className="w-4 h-4 mr-1" /> Buscar otros apellidos
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-6">
                      <h3 className="text-3xl font-black uppercase tracking-tighter text-primary">Familia {familySurnames}</h3>
                      <p className="text-base font-bold text-muted-foreground leading-relaxed">No hemos encontrado ninguna familia con estos apellidos. ¿Quieres crearla ahora?</p>
                      <div className="flex flex-col gap-3">
                        <Button onClick={() => createFamily(familySurnames, selectedRole)} className="w-full h-20 rounded-3xl font-black text-xl shadow-2xl uppercase tracking-tighter">
                          CREAR ESTA FAMILIA
                        </Button>
                        <Button variant="ghost" onClick={() => setStep('search')} className="h-12 rounded-xl font-black uppercase text-xs text-muted-foreground">
                          <ChevronLeft className="w-4 h-4 mr-1" /> Corregir apellidos
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="p-10 pt-0 border-t bg-muted/5 mt-6">
              <Button 
                variant="ghost" 
                onClick={() => logout()} 
                className="w-full h-12 rounded-xl font-black uppercase text-[10px] text-muted-foreground hover:text-destructive mt-6"
              >
                <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const meetingDateObj = upcomingMeeting ? (upcomingMeeting.date as any).toDate() : new Date();
  const registrationOpeningDate = upcomingMeeting ? getRegistrationOpeningDate(meetingDateObj) : null;
  const isRegistrationCurrentlyOpen = upcomingMeeting 
    ? (upcomingMeeting.status === 'open' || (upcomingMeeting.status === 'upcoming' && isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate(), registrationOpeningDate)))
    : false;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Navbar />
      <main className="container mx-auto px-4 py-12 space-y-12 max-w-4xl">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter uppercase text-primary drop-shadow-sm">{familyData?.name || '...'}</h1>
          <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Unidad Familiar</p>
        </div>

        <section className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <CalendarIcon className="text-primary w-6 h-6" /> Próxima Reunión
            </h2>
            <div className="w-12 h-1 bg-primary/20 rounded-full" />
          </div>

          {loadingMeetings ? (
            <Skeleton className="h-80 w-full rounded-3xl" />
          ) : upcomingMeeting ? (
            <Card className="border-4 border-primary/10 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-primary/5 p-8 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-2xl text-primary font-black leading-tight uppercase tracking-tighter">
                    {upcomingMeeting.title}
                  </CardTitle>
                  {!isRegistrationCurrentlyOpen && (
                    <Badge variant="destructive" className="w-fit font-black uppercase px-3 py-1 text-[10px] tracking-widest shadow-md">
                      <Lock className="w-3 h-3 mr-1" /> Inscripción Cerrada
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-base font-bold text-muted-foreground">
                  <CalendarIcon className="w-4 h-4" /> {formatDateTime(upcomingMeeting.date)}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isRegistrationCurrentlyOpen ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {(!sortedChildren || sortedChildren.length === 0) ? (
                        <div className="py-8 text-center space-y-4">
                          <p className="text-muted-foreground font-bold italic">Primero añade a tus hijos en el perfil familiar.</p>
                          <Button asChild variant="outline" className="rounded-xl font-black uppercase">
                            <Link href="/family">Configurar Familia</Link>
                          </Button>
                        </div>
                      ) : (
                        sortedChildren.map(child => {
                          const ageMonths = calculateAgeInMonths((child.birthDate as any).toDate(), meetingDateObj);
                          const isSelected = selectedChildren.includes(child.id);
                          const currentGroup = upcomingMeeting.ageGroups.find((g: any) => ageMonths >= g.minMonths && ageMonths < g.maxMonths);
                          const allowsGuitar = currentGroup?.allowsGuitar;

                          return (
                            <div key={child.id} className="space-y-2">
                              <div 
                                className={`flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                  isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-white hover:border-primary/10'
                                }`}
                                onClick={() => {
                                  setSelectedChildren(prev => isSelected ? prev.filter(id => id !== child.id) : [...prev, child.id]);
                                }}
                              >
                                <Checkbox checked={isSelected} className="w-6 h-6 rounded-lg border-2" onClick={(e) => e.stopPropagation()} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <p className="text-lg font-black leading-none">{child.name}</p>
                                    <div className="w-6 h-6">
                                      <ChildIconHelper gender={child.gender} />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase">
                                      {ageMonths >= 12 ? `${Math.floor(ageMonths / 12)} años` : `${ageMonths} meses`}
                                    </p>
                                    {currentGroup && <Badge variant="outline" className="text-[8px] font-black uppercase px-2">{currentGroup.label}</Badge>}
                                  </div>
                                </div>
                              </div>
                              {isSelected && allowsGuitar && (
                                <div className="ml-8 flex items-center justify-between p-3 bg-accent/5 rounded-xl border-2 border-accent/20">
                                  <div className="flex items-center gap-2">
                                    <Music className="w-4 h-4 text-accent" />
                                    <span className="text-xs font-black uppercase tracking-tight">¿Apuntar a clase de guitarra?</span>
                                  </div>
                                  <Switch 
                                    checked={guitarSelections[child.id] || false} 
                                    onCheckedChange={() => toggleGuitar(child.id)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {registration && registration.children && registration.children.length > 0 ? (
                      <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                          <CheckCircle2 className="w-6 h-6 text-primary" />
                          <div>
                            <p className="text-sm font-black uppercase tracking-tight">Inscripción Confirmada</p>
                            <p className="text-xs text-muted-foreground font-medium">Asistencia cerrada para esta reunión.</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {registration.children.map((child: any) => (
                            <div key={child.childId} className="p-5 rounded-2xl border bg-muted/5 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10">
                                  <ChildIconHelper gender={child.gender} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-lg leading-none">{child.name}</p>
                                  </div>
                                  <Badge variant="outline" className="text-[9px] font-black uppercase px-2 mt-1">
                                    {child.ageGroupLabel}
                                  </Badge>
                                </div>
                              </div>
                              {child.guitarSelected && (
                                <Badge className="bg-accent text-white font-black uppercase text-[8px] px-3 py-1">
                                  <Music className="w-3 h-3 mr-1" /> Guitarra
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center space-y-6">
                        <AlertCircle className="text-destructive w-12 h-12 mx-auto" />
                        <div className="space-y-1">
                          <p className="text-xl font-black text-destructive uppercase">Inscripciones Cerradas</p>
                          <p className="text-sm text-muted-foreground font-bold">No se realizó ninguna inscripción para esta fecha.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              {isRegistrationCurrentlyOpen && sortedChildren && sortedChildren.length > 0 && (
                <CardFooter className="p-6 pt-0 flex flex-col gap-4">
                  <Button onClick={handleRegister} className="w-full h-14 text-lg rounded-2xl font-black shadow-xl uppercase tracking-tighter">
                    {registration ? 'Actualizar Inscripción' : 'Confirmar Asistencia'}
                  </Button>
                </CardFooter>
              )}
            </Card>
          ) : (
            <div className="py-24 text-center border-4 border-dashed rounded-[2.5rem] bg-muted/10">
              <p className="text-muted-foreground font-black text-xl uppercase opacity-40">No hay reuniones próximas programadas</p>
            </div>
          )}
        </section>

        <section className="pt-8">
          <Card className="rounded-3xl border-2 bg-muted/5 border-dashed hover:bg-white transition-all group overflow-hidden shadow-sm">
            <Link href="/family" className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                  <Plus className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Mi Familia</h3>
                  <p className="text-sm font-bold text-muted-foreground">{children?.length || 0} hijos registrados</p>
                </div>
              </div>
              <ArrowRight className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-2" />
            </Link>
          </Card>
        </section>
      </main>
    </div>
  );
}
