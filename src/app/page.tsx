
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Baby, History, X, Users, Copy, Check } from 'lucide-react';
import { collection, query, where, orderBy, limit, doc, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDate, isRegistrationOpen, calculateAgeInMonths } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

export default function ParentDashboard() {
  const { user, userData, login, joinFamily, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  // UI State
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isManagingFamily, setIsManagingFamily] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Forms state
  const [newChildName, setNewChildName] = useState('');
  const [newChildBirthDate, setNewChildBirthDate] = useState('');
  const [joinFamilyId, setJoinFamilyId] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  // Memoized Queries - Now pointing to FAMILIES
  const childrenQuery = useMemoFirebase(() => {
    if (!db || !userData?.familyId) return null;
    return collection(db, 'families', userData.familyId, 'children');
  }, [db, userData?.familyId]);

  const upcomingMeetingsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'meetings'), 
      where('status', '==', 'upcoming'), 
      orderBy('date', 'asc'), 
      limit(1)
    );
  }, [db]);

  // Hooks for Data
  const { data: children, isLoading: loadingChildren } = useCollection(childrenQuery);
  const { data: upcomingMeetings, isLoading: loadingMeetings } = useCollection(upcomingMeetingsQuery);
  
  const upcomingMeeting = upcomingMeetings?.[0] || null;

  const registrationRef = useMemoFirebase(() => {
    if (!db || !upcomingMeeting || !userData?.familyId) return null;
    return doc(db, 'meetings', upcomingMeeting.id, 'registrations', userData.familyId);
  }, [db, upcomingMeeting, userData?.familyId]);

  const { data: registration } = useDoc(registrationRef);

  // Sync selected children with registration data (shared between parents)
  useEffect(() => {
    if (registration && registration.children) {
      setSelectedChildren(registration.children.map((c: any) => c.childId));
    }
  }, [registration]);

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

  const handleDeleteChild = (childId: string) => {
    if (!userData?.familyId || !db) return;
    const childDocRef = doc(db, 'families', userData.familyId, 'children', childId);
    deleteDocumentNonBlocking(childDocRef);
    toast({ title: "Perfil eliminado", description: "Se ha borrado el perfil del niño." });
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
      children: childrenToRegister,
      registeredAt: registration?.registeredAt || Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    }, { merge: true });

    toast({ 
      title: registration ? "¡Inscripción actualizada!" : "¡Inscripción confirmada!", 
      description: `Inscripción guardada para toda la familia.` 
    });
  };

  const toggleChildSelection = (childId: string) => {
    setSelectedChildren(prev => 
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    );
  };

  const copyFamilyId = () => {
    if (userData?.familyId) {
      navigator.clipboard.writeText(userData.familyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copiado", description: "Envía este código a tu pareja para uniros." });
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-bold">Cargando CongreKids...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8 animate-pulse">
          <Baby className="w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black text-primary tracking-tighter mb-4">CongreKids</h1>
        <p className="text-xl text-muted-foreground max-w-sm mb-12 font-medium">
          La forma más fácil de gestionar la guardería de la Congregación.
        </p>
        <Button size="lg" onClick={login} className="w-full max-w-xs h-16 text-xl rounded-2xl shadow-xl font-bold">
          Entrar con Google
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-10">
        
        {/* Family Access Section - For linking parents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              <Users className="text-primary w-6 h-6" /> Familia
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setIsManagingFamily(!isManagingFamily)} className="font-bold">
              {isManagingFamily ? 'Cerrar' : 'Gestionar'}
            </Button>
          </div>
          
          {isManagingFamily && (
            <Card className="rounded-2xl border-primary/20 bg-primary/5 mb-6">
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label className="text-xs uppercase font-bold text-muted-foreground mb-2 block">Tu Código de Familia</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={userData?.familyId || ''} className="bg-white font-mono text-sm h-12 rounded-xl" />
                    <Button onClick={copyFamilyId} variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0">
                      {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">Comparte este código con tu pareja para que ambos veáis a los mismos hijos.</p>
                </div>
                
                <div className="pt-4 border-t border-primary/10">
                  <Label className="text-xs uppercase font-bold text-muted-foreground mb-2 block">¿Tienes un código de tu pareja?</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Pega el código aquí" 
                      value={joinFamilyId}
                      onChange={(e) => setJoinFamilyId(e.target.value)}
                      className="bg-white h-12 rounded-xl" 
                    />
                    <Button onClick={() => joinFamily(joinFamilyId)} className="h-12 rounded-xl font-bold">Unirse</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Children Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              <Baby className="text-primary w-7 h-7" /> Mis Hijos
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loadingChildren ? (
              [1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)
            ) : (
              <>
                {children?.map(child => (
                  <Card key={child.id} className="relative overflow-hidden border-primary/5 shadow-md rounded-2xl bg-white">
                    <CardHeader className="p-5 pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-black">{child.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteChild(child.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardDescription className="text-sm font-medium">
                        Nacido el {formatDate(child.birthDate)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-2">
                      <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">
                        {Math.floor(calculateAgeInMonths((child.birthDate as any).toDate(), new Date()) / 12)} años
                      </span>
                    </CardContent>
                  </Card>
                ))}
                
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddingChild(true)}
                  className="h-40 w-full border-dashed border-2 rounded-2xl flex flex-col gap-3 hover:bg-primary/5 hover:border-primary/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-primary">Añadir hijo</span>
                </Button>
              </>
            )}
          </div>

          {isAddingChild && (
            <Card className="mt-8 shadow-2xl border-primary/10 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <CardHeader className="bg-primary/5 p-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Nuevo Perfil</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsAddingChild(false)} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </CardHeader>
              <form onSubmit={handleAddChild}>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-bold">Nombre del niño</Label>
                    <Input 
                      id="name" 
                      placeholder="Ej. Pablo García" 
                      value={newChildName}
                      onChange={(e) => setNewChildName(e.target.value)}
                      required
                      className="h-14 text-base rounded-xl border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate" className="text-sm font-bold">Fecha de nacimiento</Label>
                    <Input 
                      id="birthDate" 
                      type="date" 
                      value={newChildBirthDate}
                      onChange={(e) => setNewChildBirthDate(e.target.value)}
                      required
                      className="h-14 text-base rounded-xl border-2"
                    />
                  </div>
                </CardContent>
                <CardFooter className="p-6 pt-0 flex flex-col gap-3">
                  <Button type="submit" className="w-full h-14 text-lg rounded-xl font-black shadow-lg">
                    Guardar hijo
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setIsAddingChild(false)} className="w-full font-bold">
                    Cancelar
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </section>

        {/* Meeting Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <CalendarIcon className="text-primary w-7 h-7" />
            <h2 className="text-2xl font-black tracking-tight">Próxima Reunión</h2>
          </div>

          {loadingMeetings ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : upcomingMeeting ? (
            <Card className="border-primary/10 shadow-xl rounded-3xl overflow-hidden bg-white">
              <CardHeader className="bg-primary/5 p-6 space-y-4">
                <CardTitle className="text-2xl text-primary font-black leading-tight">
                  {upcomingMeeting.title}
                </CardTitle>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDate(upcomingMeeting.date)}
                  </div>
                  <div className="text-xs font-bold text-destructive uppercase tracking-tighter">
                    Límite: {formatDate(upcomingMeeting.registrationDeadline)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate()) ? (
                  <div className="space-y-6">
                    <p className="text-sm font-medium text-muted-foreground bg-muted/30 p-4 rounded-xl">
                      Selecciona quiénes asistirán. Los datos se sincronizarán con tu pareja automáticamente.
                    </p>

                    <div className="space-y-3">
                      {(!children || children.length === 0) ? (
                        <div className="py-12 text-center border-2 border-dashed rounded-2xl">
                          <p className="text-muted-foreground font-bold px-6">Primero añade a tus hijos arriba.</p>
                        </div>
                      ) : (
                        children.map(child => (
                          <div 
                            key={child.id} 
                            className={`flex items-center space-x-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                              selectedChildren.includes(child.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-white'
                            }`}
                            onClick={() => toggleChildSelection(child.id)}
                          >
                            <Checkbox 
                              checked={selectedChildren.includes(child.id)}
                              onCheckedChange={() => toggleChildSelection(child.id)}
                              className="w-7 h-7 rounded-lg border-2"
                            />
                            <div className="flex-1">
                              <p className="text-lg font-black">{child.name}</p>
                              <p className="text-xs font-bold text-muted-foreground">
                                {Math.floor(calculateAgeInMonths((child.birthDate as any).toDate(), (upcomingMeeting.date as any).toDate()))} meses aprox.
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <AlertCircle className="text-destructive w-12 h-12 mx-auto" />
                    <p className="text-xl font-black text-destructive uppercase">Plazo Cerrado</p>
                  </div>
                )}
              </CardContent>
              {isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate()) && children && children.length > 0 && (
                <CardFooter className="p-6 flex flex-col gap-4">
                  <Button onClick={handleRegister} className="w-full h-16 text-xl rounded-2xl font-black shadow-xl">
                    {registration ? 'Actualizar inscripción' : 'Confirmar asistencia'}
                  </Button>
                  {registration && (
                    <div className="flex items-center gap-2 text-green-600 font-bold justify-center py-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm">Inscripción compartida guardada</span>
                    </div>
                  )}
                </CardFooter>
              )}
            </Card>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-muted/10">
              <p className="text-muted-foreground font-bold">No hay reuniones programadas.</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
