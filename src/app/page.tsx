
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Baby, History } from 'lucide-react';
import { collection, query, where, orderBy, limit, doc, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDate, isRegistrationOpen, calculateAgeInMonths } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

export default function ParentDashboard() {
  const { user, userData, login, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  // Child form state
  const [newChildName, setNewChildName] = useState('');
  const [newChildBirthDate, setNewChildBirthDate] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  // Memoized Queries - Ensure they wait for 'user' to be available to avoid permission errors
  const childrenQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'children');
  }, [db, user]);

  const upcomingMeetingsQuery = useMemoFirebase(() => {
    if (!db || !user) return null; // Wait for user authentication
    return query(
      collection(db, 'meetings'), 
      where('status', '==', 'upcoming'), 
      orderBy('date', 'asc'), 
      limit(1)
    );
  }, [db, user]);

  // Hooks for Data
  const { data: children, isLoading: loadingChildren } = useCollection(childrenQuery);
  const { data: upcomingMeetings, isLoading: loadingMeetings } = useCollection(upcomingMeetingsQuery);
  
  const upcomingMeeting = upcomingMeetings?.[0] || null;

  const registrationRef = useMemoFirebase(() => {
    if (!db || !upcomingMeeting || !user) return null;
    return doc(db, 'meetings', upcomingMeeting.id, 'registrations', user.uid);
  }, [db, upcomingMeeting, user]);

  const { data: registration } = useDoc(registrationRef);

  // Sync selected children with registration data when it loads
  useEffect(() => {
    if (registration && registration.children) {
      setSelectedChildren(registration.children.map((c: any) => c.childId));
    }
  }, [registration]);

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newChildName || !newChildBirthDate || !childrenQuery) return;

    const birthDate = new Date(newChildBirthDate);
    addDocumentNonBlocking(childrenQuery, {
      parentId: user.uid,
      name: newChildName,
      birthDate: Timestamp.fromDate(birthDate),
    });
    
    setNewChildName('');
    setNewChildBirthDate('');
    toast({ title: "¡Hijo añadido!", description: "Se ha guardado correctamente el perfil." });
  };

  const handleDeleteChild = (childId: string) => {
    if (!user || !db) return;
    const childDocRef = doc(db, 'users', user.uid, 'children', childId);
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
          // Some age groups might be stored as objects or strings, let's be robust
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
      parentId: user.uid,
      parentName: userData.displayName,
      parentEmail: userData.email,
      children: childrenToRegister,
      registeredAt: registration?.registeredAt || Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    }, { merge: true });

    toast({ 
      title: registration ? "¡Inscripción actualizada!" : "¡Inscripción confirmada!", 
      description: `Has inscrito a ${childrenToRegister.length} hijos para la reunión.` 
    });
  };

  const toggleChildSelection = (childId: string) => {
    setSelectedChildren(prev => 
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    );
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-bold">Cargando CongreKids...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md bg-white p-10 rounded-3xl shadow-xl border border-primary/5">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4 animate-bounce">
            <Baby className="w-12 h-12" />
          </div>
          <h1 className="text-5xl font-bold text-primary tracking-tighter">CongreKids</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Gestión de guardería para la Congregación Mater Salvatoris. Inicia sesión para inscribir a tus hijos.
          </p>
          <Button size="lg" onClick={login} className="w-full text-lg h-16 rounded-2xl shadow-lg hover:scale-105 transition-transform">
            Entrar con Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-12">
        
        {/* Children Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
              <Baby className="text-primary w-8 h-8" /> Mis Hijos
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loadingChildren ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)
            ) : (
              <>
                {children?.map(child => (
                  <Card key={child.id} className="group overflow-hidden border-primary/10 hover:border-primary/30 transition-all shadow-md hover:shadow-xl rounded-2xl">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl font-bold">{child.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChild(child.id);
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                      <CardDescription className="text-base">
                        Nacido el {formatDate(child.birthDate)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-sm font-bold px-4 py-1.5 bg-primary/10 text-primary rounded-full inline-block">
                        {Math.floor(calculateAgeInMonths((child.birthDate as any).toDate(), new Date()) / 12)} años
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Card className="border-dashed border-2 flex flex-col items-center justify-center p-8 text-center space-y-4 hover:bg-primary/5 transition-all cursor-pointer rounded-2xl bg-white/50" 
                      onClick={() => document.getElementById('new-child-form')?.scrollIntoView({ behavior: 'smooth' })}>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Plus className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-bold text-primary">Añadir perfil</p>
                </Card>
              </>
            )}
          </div>

          <Card id="new-child-form" className="mt-10 max-w-xl shadow-lg border-primary/5 rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-xl">Registrar nuevo perfil</CardTitle>
              <CardDescription>Añade a tus hijos para poder inscribirlos en las reuniones.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddChild}>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-base">Nombre completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Ej. Pablo García" 
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    required
                    className="h-12 text-lg rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="text-base">Fecha de nacimiento</Label>
                  <Input 
                    id="birthDate" 
                    type="date" 
                    value={newChildBirthDate}
                    onChange={(e) => setNewChildBirthDate(e.target.value)}
                    required
                    className="h-12 text-lg rounded-xl"
                  />
                </div>
              </CardContent>
              <CardFooter className="pb-8">
                <Button type="submit" className="w-full h-14 text-lg rounded-xl shadow-md">Guardar Perfil</Button>
              </CardFooter>
            </form>
          </Card>
        </section>

        {/* Meeting Section */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <CalendarIcon className="text-primary w-8 h-8" />
            <h2 className="text-3xl font-bold tracking-tight">Próxima Reunión</h2>
          </div>

          {loadingMeetings ? (
            <Skeleton className="h-80 w-full rounded-3xl" />
          ) : upcomingMeeting ? (
            <Card className="border-primary/20 bg-white/80 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-primary/5 pb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <CardTitle className="text-3xl text-primary font-black tracking-tighter">{upcomingMeeting.title}</CardTitle>
                    <CardDescription className="text-xl flex items-center gap-3 mt-2 font-medium">
                      <CalendarIcon className="w-5 h-5" />
                      {formatDate(upcomingMeeting.date)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-start md:items-end bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
                    <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Límite inscripción</span>
                    <span className="text-lg font-black text-primary">{formatDate(upcomingMeeting.registrationDeadline)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                {isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate()) ? (
                  <div className="space-y-8">
                    <div className="bg-accent/10 p-5 rounded-2xl flex gap-4 items-start border border-accent/20">
                      <AlertCircle className="text-accent shrink-0 mt-1 w-6 h-6" />
                      <p className="text-base font-medium">
                        Marca los niños que asistirán. El grupo de edad se asignará automáticamente según su edad el día de la reunión.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(!children || children.length === 0) ? (
                        <div className="col-span-2 p-10 text-center border-2 border-dashed rounded-2xl bg-muted/10">
                          <p className="text-lg text-muted-foreground italic font-medium">Primero añade a tus hijos en la sección superior.</p>
                        </div>
                      ) : (
                        children.map(child => (
                          <div 
                            key={child.id} 
                            className={`flex items-center space-x-4 p-6 rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                              selectedChildren.includes(child.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-white'
                            }`}
                            onClick={() => toggleChildSelection(child.id)}
                          >
                            <Checkbox 
                              checked={selectedChildren.includes(child.id)}
                              onCheckedChange={() => toggleChildSelection(child.id)}
                              className="w-6 h-6 rounded-md"
                            />
                            <div className="flex-1">
                              <p className="text-xl font-black leading-tight">{child.name}</p>
                              <p className="text-sm font-bold text-muted-foreground mt-1">
                                {Math.floor(calculateAgeInMonths((child.birthDate as any).toDate(), (upcomingMeeting.date as any).toDate()))} meses el día del evento
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-destructive/10 p-10 rounded-3xl text-center flex flex-col items-center gap-4 border border-destructive/20">
                    <AlertCircle className="text-destructive w-12 h-12" />
                    <p className="text-2xl font-black text-destructive uppercase tracking-tighter">Plazo Cerrado</p>
                    <p className="text-lg font-medium text-muted-foreground max-w-md">Lo sentimos, la fecha límite para inscribirse en esta reunión ha pasado.</p>
                  </div>
                )}
              </CardContent>
              {isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate()) && children && children.length > 0 && (
                <CardFooter className="flex flex-col items-start gap-6 pb-10">
                  <Button onClick={handleRegister} size="lg" className="w-full md:w-auto h-16 px-16 text-xl rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">
                    {registration ? 'Actualizar inscripción' : 'Confirmar asistencia'}
                  </Button>
                  {registration && (
                    <div className="flex items-center gap-3 text-green-600 font-bold bg-green-50 px-6 py-3 rounded-xl border border-green-200">
                      <CheckCircle2 className="w-6 h-6" />
                      <span>¡Inscripción confirmada! Puedes cambiar tu selección hasta el cierre del plazo.</span>
                    </div>
                  )}
                </CardFooter>
              )}
            </Card>
          ) : (
            <div className="p-20 text-center border-4 border-dashed rounded-[3rem] bg-muted/20 border-muted-foreground/10">
              <CalendarIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-2xl font-bold text-muted-foreground">No hay reuniones próximas programadas.</p>
            </div>
          )}
        </section>

        {/* History Placeholder */}
        <section className="pb-20">
          <div className="flex items-center gap-3 mb-8">
            <History className="text-primary w-8 h-8" />
            <h2 className="text-3xl font-bold tracking-tight">Mi Historial</h2>
          </div>
          <Card className="rounded-3xl border-primary/5 shadow-inner bg-muted/5">
            <CardContent className="p-16 text-center text-muted-foreground font-medium">
              <p className="text-lg">Tus inscripciones pasadas aparecerán aquí muy pronto.</p>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
}
