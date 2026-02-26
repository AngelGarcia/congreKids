
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Baby, X, Users, Copy, Check, Edit2, UserPlus, Home, Heart, ShieldCheck, ArrowRight, Settings, LayoutDashboard } from 'lucide-react';
import { collection, query, where, orderBy, limit, doc, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDate, isRegistrationOpen, calculateAgeInMonths } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';

export default function ParentDashboard() {
  const { user, userData, familyData, familyMembers, login, joinFamily, createFamily, updateFamilyName, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  // UI State
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [isManagingFamily, setIsManagingFamily] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'padre' | 'madre'>('padre');
  
  // Forms state
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [newChildBirthDate, setNewChildBirthDate] = useState('');
  const [editFamilyName, setEditFamilyName] = useState('');
  const [joinFamilyId, setJoinFamilyId] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  useEffect(() => {
    if (familyData?.name) setEditFamilyName(familyData.name);
  }, [familyData]);

  const childrenQuery = useMemoFirebase(() => {
    if (!db || !userData?.familyId || !user) return null;
    return collection(db, 'families', userData.familyId, 'children');
  }, [db, userData?.familyId, user]);

  const upcomingMeetingsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'meetings'), 
      where('status', '==', 'upcoming'), 
      orderBy('date', 'asc'), 
      limit(1)
    );
  }, [db, user]);

  const { data: children, isLoading: loadingChildren } = useCollection(childrenQuery);
  const { data: upcomingMeetings, isLoading: loadingMeetings } = useCollection(upcomingMeetingsQuery);
  const upcomingMeeting = upcomingMeetings?.[0] || null;

  const registrationRef = useMemoFirebase(() => {
    if (!db || !upcomingMeeting || !userData?.familyId || !user) return null;
    return doc(db, 'meetings', upcomingMeeting.id, 'registrations', userData.familyId);
  }, [db, upcomingMeeting, userData?.familyId, user]);

  const { data: registration } = useDoc(registrationRef);

  useEffect(() => {
    if (registration && registration.children) {
      setSelectedChildren(registration.children.map((c: any) => c.childId));
    }
  }, [registration]);

  const handleCreateFamily = (e: React.FormEvent) => {
    e.preventDefault();
    createFamily(newFamilyName.trim() || "", selectedRole);
  };

  const handleJoinFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinFamilyId.trim()) {
      joinFamily(joinFamilyId.trim(), selectedRole);
    }
  };

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.familyId || !newChildName || !newChildBirthDate || !childrenQuery) return;

    const birthDate = new Date(newChildBirthDate);
    addDocumentNonBlocking(childrenQuery, {
      familyId: userData.familyId,
      name: newChildName,
      birthDate: Timestamp.fromDate(birthDate),
    });
    
    setNewChildName('');
    setNewChildBirthDate('');
    setIsAddingChild(false);
    toast({ title: "¡Hijo añadido!", description: "Ahora es visible para ambos padres." });
  };

  const handleUpdateFamilyName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFamilyName.trim()) {
      updateFamilyName(editFamilyName.trim());
      setIsEditingFamilyName(false);
    }
  };

  const handleDeleteChild = (childId: string) => {
    if (!userData?.familyId || !db) return;
    const childDocRef = doc(db, 'families', userData.familyId, 'children', childId);
    deleteDocumentNonBlocking(childDocRef);
  };

  const handleRegister = () => {
    if (!user || !upcomingMeeting || !userData || !registrationRef) return;

    const meetingDate = (upcomingMeeting.date as any).toDate();
    const childrenToRegister = (children || [])
      .filter(c => selectedChildren.includes(c.id))
      .map(c => {
        const ageMonths = calculateAgeInMonths((c.birthDate as any).toDate(), meetingDate);
        const group = upcomingMeeting.ageGroups.find((g: any) => {
          const parsedGroup = typeof g === 'string' ? JSON.parse(g) : g;
          return ageMonths >= parsedGroup.minMonths && ageMonths < parsedGroup.maxMonths;
        });
        
        const groupLabel = group 
          ? (typeof group === 'string' ? JSON.parse(group).label : group.label) 
          : "Sin grupo";

        return {
          childId: c.id,
          name: c.name,
          birthDate: c.birthDate,
          ageGroupLabel: groupLabel
        };
      });

    setDocumentNonBlocking(registrationRef, {
      meetingId: upcomingMeeting.id,
      familyId: userData.familyId,
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

  const copyFamilyId = () => {
    if (userData?.familyId) {
      navigator.clipboard.writeText(userData.familyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copiado", description: "Envía este código a tu pareja para uniros." });
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black text-primary text-2xl uppercase tracking-tighter">CongreKids...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8">
          <Baby className="w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black text-primary tracking-tighter mb-4">CongreKids</h1>
        <p className="text-xl text-muted-foreground max-w-sm mb-12 font-medium">Gestiona el cuidado infantil de tu parroquia.</p>
        <Button size="lg" onClick={login} className="w-full max-w-xs h-16 text-xl rounded-2xl shadow-xl font-black">
          Entrar con Google
        </Button>
      </div>
    );
  }

  if (!userData?.familyId) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md rounded-3xl border-4 border-primary/10 shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
              <Home className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black uppercase tracking-tighter">Bienvenido</CardTitle>
            <CardDescription className="text-base font-bold">Para empezar, define tu unidad familiar o únete a una existente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            <div className="space-y-6">
              <Label className="text-xs font-black uppercase text-primary">Primero, ¿cuál es tu rol?</Label>
              <RadioGroup value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)} className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[120px]">
                  <RadioGroupItem value="padre" id="padre" className="peer sr-only" />
                  <Label
                    htmlFor="padre"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary transition-all cursor-pointer"
                  >
                    <span className="text-base font-black uppercase">Padre</span>
                  </Label>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <RadioGroupItem value="madre" id="madre" className="peer sr-only" />
                  <Label
                    htmlFor="madre"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary transition-all cursor-pointer"
                  >
                    <span className="text-base font-black uppercase">Madre</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase text-primary">
                Crear Nueva Familia
              </Label>
              <form onSubmit={handleCreateFamily} className="flex flex-col gap-3">
                <Input 
                  placeholder="Apellidos (ej. García Medina)" 
                  value={newFamilyName}
                  onChange={e => setNewFamilyName(e.target.value)}
                  className="h-14 rounded-xl border-2 font-bold"
                />
                <Button type="submit" className="h-14 rounded-xl font-black text-lg">
                  CREAR FAMILIA
                </Button>
              </form>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-muted-foreground/20" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">O TAMBIÉN</span></div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase text-primary">Unirse con código</Label>
              <form onSubmit={handleJoinFamily} className="flex flex-col gap-3">
                <Input 
                  placeholder="Pega el código de tu pareja" 
                  value={joinFamilyId}
                  onChange={e => setJoinFamilyId(e.target.value)}
                  className="h-14 rounded-xl border-2 font-bold"
                />
                <Button variant="outline" type="submit" className="h-14 rounded-xl font-black text-lg border-2">UNIRSE A MI PAREJA</Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedMembers = [...familyMembers].sort((a, b) => {
    if (a.role === 'padre') return -1;
    if (b.role === 'padre') return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-12">
        
        {/* Admin Quick Access Banner */}
        {userData.isAdmin && (
          <div className="max-w-4xl mx-auto">
            <Link href="/admin">
              <div className="bg-primary/90 text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between hover:bg-primary transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-tight text-lg">Modo Administrador Activo</h3>
                    <p className="text-white/80 text-sm font-medium">Gestiona reuniones, familias y permisos.</p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </div>
            </Link>
          </div>
        )}

        {/* Family Tree Header Section */}
        <section className="flex flex-col items-center text-center space-y-8 relative">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              {isEditingFamilyName ? (
                <form onSubmit={handleUpdateFamilyName} className="flex gap-2 max-w-sm">
                  <Input 
                    value={editFamilyName} 
                    onChange={e => setEditFamilyName(e.target.value)}
                    className="h-12 text-2xl font-black border-2 rounded-xl text-center"
                    autoFocus
                  />
                  <Button type="submit" size="icon" className="h-12 w-12 rounded-xl"><Check /></Button>
                </form>
              ) : (
                <>
                  <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase text-primary drop-shadow-sm">
                    {familyData?.name || '...'}
                  </h1>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingFamilyName(true)} className="text-muted-foreground hover:text-primary mb-4">
                    <Edit2 className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-sm font-black text-muted-foreground uppercase tracking-[0.3em]">Unidad Familiar</p>
          </div>

          <div className="flex items-center justify-center gap-8 relative">
            {sortedMembers.length > 1 && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-1 bg-primary/10 -z-10 rounded-full" />
            )}
            
            {sortedMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-2">
                <div className="relative">
                  <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-white shadow-xl ring-4 ring-primary/5">
                    <AvatarImage src={member.photoURL || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-2xl uppercase">
                      {member.role?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  {member.isAdmin && (
                    <div className="absolute -top-1 -right-1 bg-accent text-white p-1 rounded-lg shadow-lg">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-primary tracking-widest">{member.role}</span>
                  <span className="text-sm font-bold text-foreground">{member.displayName?.split(' ')[0]}</span>
                </div>
              </div>
            ))}

            {familyMembers.length < 2 && (
              <div className="flex flex-col items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setIsManagingFamily(true)}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-dashed border-primary/20 bg-primary/5 text-primary shadow-inner hover:bg-primary/10 transition-all"
                >
                  <UserPlus className="w-8 h-8" />
                </Button>
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Invitar</span>
              </div>
            )}
          </div>

          <div className="w-1 h-12 bg-primary/10 rounded-full" />

          {isManagingFamily && (
            <Card className="w-full max-w-md rounded-2xl border-2 border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 text-left">
                    <Label className="text-xs uppercase font-black text-primary mb-2 block">Código de Enlace</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={userData?.familyId || ''} className="bg-white font-mono text-sm h-12 rounded-xl border-2" />
                      <Button onClick={copyFamilyId} variant="outline" size="icon" className="h-12 w-12 rounded-xl">
                        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground font-medium italic">Tu pareja debe pegar este código para unirse a vuestra familia.</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsManagingFamily(false)}><X /></Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Children Section */}
        <section className="space-y-8">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Baby className="text-primary w-8 h-8" /> Nuestros Hijos
            </h2>
            <div className="w-16 h-1.5 bg-primary/20 rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loadingChildren ? (
              [1, 2].map(i => <Skeleton key={i} className="h-44 w-full rounded-3xl" />)
            ) : (
              <>
                {children?.map(child => (
                  <Card key={child.id} className="relative overflow-hidden border-2 border-primary/5 hover:border-primary/20 transition-all shadow-lg rounded-3xl bg-white group">
                    <CardHeader className="p-6">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-2xl font-black">{child.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteChild(child.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                      <CardDescription className="text-base font-bold text-muted-foreground">
                        Nacido el {formatDate(child.birthDate)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0">
                      <Badge variant="secondary" className="px-4 py-1 text-sm rounded-xl bg-primary/10 text-primary border-none font-black">
                        {Math.floor(calculateAgeInMonths((child.birthDate as any).toDate(), new Date()) / 12)} años
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
                
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddingChild(true)}
                  className="h-44 w-full border-dashed border-3 rounded-3xl flex flex-col gap-4 hover:bg-primary/5 hover:border-primary/40 transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="font-black text-lg text-primary uppercase">Añadir hijo</span>
                </Button>
              </>
            )}
          </div>

          {isAddingChild && (
            <Card className="shadow-2xl border-2 border-primary/10 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-w-xl mx-auto">
              <CardHeader className="bg-primary/5 p-8 flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-black uppercase tracking-tighter">Nuevo Perfil</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsAddingChild(false)} className="rounded-full h-12 w-12"><X /></Button>
              </CardHeader>
              <form onSubmit={handleAddChild}>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Nombre del niño/a</Label>
                    <Input 
                      id="name" 
                      placeholder="Ej. Pablo" 
                      value={newChildName}
                      onChange={(e) => setNewChildName(e.target.value)}
                      required
                      className="h-16 text-lg rounded-2xl border-2 bg-muted/20"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="birthDate" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Fecha de nacimiento</Label>
                    <Input 
                      id="birthDate" 
                      type="date" 
                      value={newChildBirthDate}
                      onChange={(e) => setNewChildBirthDate(e.target.value)}
                      required
                      className="h-16 text-lg rounded-2xl border-2 bg-muted/20"
                    />
                  </div>
                </CardContent>
                <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                  <Button type="submit" className="w-full h-16 text-xl rounded-2xl font-black shadow-xl uppercase tracking-tighter">
                    Guardar Hijo
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </section>

        {/* Meeting Section */}
        <section className="space-y-8">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <CalendarIcon className="text-primary w-8 h-8" /> Inscripción Guardería
            </h2>
            <div className="w-16 h-1.5 bg-primary/20 rounded-full" />
          </div>

          {loadingMeetings ? (
            <Skeleton className="h-80 w-full rounded-3xl" />
          ) : upcomingMeeting ? (
            <Card className="border-4 border-primary/10 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white max-w-4xl mx-auto">
              <CardHeader className="bg-primary/5 p-8 space-y-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-3xl text-primary font-black leading-tight uppercase tracking-tighter">
                    {upcomingMeeting.title}
                  </CardTitle>
                  <Badge className="bg-primary text-white font-black px-4 py-1 text-xs rounded-full uppercase">Abierta</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-lg font-bold text-muted-foreground">
                    <CalendarIcon className="w-5 h-5" />
                    {formatDate(upcomingMeeting.date)}
                  </div>
                  <div className="text-xs font-black text-destructive uppercase tracking-[0.2em] bg-destructive/10 self-start px-3 py-1 rounded-lg">
                    Límite: {formatDate(upcomingMeeting.registrationDeadline)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate()) ? (
                  <div className="space-y-8">
                    <div className="bg-muted/30 p-6 rounded-2xl border-l-4 border-primary">
                      <p className="text-base font-bold text-foreground italic">"Selecciona a los peques que vendrán a la guardería"</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {(!children || children.length === 0) ? (
                        <div className="py-16 text-center border-3 border-dashed rounded-3xl bg-muted/10">
                          <p className="text-muted-foreground font-bold px-10">Primero añade a tus hijos arriba para poder inscribirlos.</p>
                        </div>
                      ) : (
                        children.map(child => (
                          <div 
                            key={child.id} 
                            className={`flex items-center space-x-6 p-6 rounded-3xl border-3 transition-all cursor-pointer shadow-sm ${
                              selectedChildren.includes(child.id) ? 'border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.02]' : 'border-border bg-white hover:border-primary/20'
                            }`}
                            onClick={() => {
                              const isSelected = selectedChildren.includes(child.id);
                              setSelectedChildren(prev => 
                                isSelected ? prev.filter(id => id !== child.id) : [...prev, child.id]
                              );
                            }}
                          >
                            <Checkbox 
                              checked={selectedChildren.includes(child.id)}
                              className="w-10 h-10 rounded-xl border-4 data-[state=checked]:bg-primary"
                            />
                            <div className="flex-1">
                              <p className="text-2xl font-black">{child.name}</p>
                              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                {Math.floor(calculateAgeInMonths((child.birthDate as any).toDate(), (upcomingMeeting.date as any).toDate()))} meses
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-6">
                    <AlertCircle className="text-destructive w-16 h-16 mx-auto" />
                    <p className="text-2xl font-black text-destructive uppercase tracking-tighter">Inscripciones Cerradas</p>
                    <p className="text-muted-foreground font-bold">El plazo para esta reunión ha finalizado.</p>
                  </div>
                )}
              </CardContent>
              {isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate()) && children && children.length > 0 && (
                <CardFooter className="p-8 pt-0 flex flex-col gap-6">
                  <Button onClick={handleRegister} className="w-full h-20 text-2xl rounded-3xl font-black shadow-2xl uppercase tracking-tighter hover:scale-[1.01] transition-transform">
                    {registration ? 'Actualizar Inscripción' : 'Confirmar Asistencia'}
                  </Button>
                  {registration && (
                    <div className="flex items-center gap-3 text-green-600 font-black justify-center bg-green-50 p-4 rounded-2xl w-full border-2 border-green-100">
                      <Heart className="w-6 h-6 fill-green-600" />
                      <span className="text-sm uppercase tracking-widest">Inscripción familiar guardada</span>
                    </div>
                  )}
                </CardFooter>
              )}
            </Card>
          ) : (
            <div className="py-24 text-center border-4 border-dashed rounded-[2.5rem] bg-muted/10">
              <p className="text-muted-foreground font-black text-xl uppercase opacity-40">No hay reuniones próximas</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
