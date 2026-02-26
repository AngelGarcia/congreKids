"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Baby, History } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, setDoc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate, isRegistrationOpen, calculateAgeInMonths } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface Child {
  id: string;
  name: string;
  birthDate: Timestamp;
}

interface Meeting {
  id: string;
  title: string;
  date: Timestamp;
  registrationDeadline: Timestamp;
  status: string;
  ageGroups: any[];
}

export default function ParentDashboard() {
  const { user, userData, login, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [upcomingMeeting, setUpcomingMeeting] = useState<Meeting | null>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  // Child form state
  const [newChildName, setNewChildName] = useState('');
  const [newChildBirthDate, setNewChildBirthDate] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch Children
      const childrenRef = collection(db, 'users', user.uid, 'children');
      const childrenSnap = await getDocs(childrenRef);
      const childrenData = childrenSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Child));
      setChildren(childrenData);

      // Fetch Upcoming Meeting
      const meetingsRef = collection(db, 'meetings');
      const q = query(meetingsRef, where('status', '==', 'upcoming'), orderBy('date', 'asc'), limit(1));
      const meetingsSnap = await getDocs(q);
      
      if (!meetingsSnap.empty) {
        const meeting = { id: meetingsSnap.docs[0].id, ...meetingsSnap.docs[0].data() } as Meeting;
        setUpcomingMeeting(meeting);

        // Fetch user's registration for this meeting
        const regDoc = await getDocs(query(collection(db, 'meetings', meeting.id, 'registrations'), where('__name__', '==', user.uid)));
        if (!regDoc.empty) {
          const regData = regDoc.docs[0].data();
          setRegistration(regData);
          setSelectedChildren(regData.children?.map((c: any) => c.childId) || []);
        }
      }

      // Fetch History (Simplified)
      // In a real app we'd query past registrations
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newChildName || !newChildBirthDate) return;

    try {
      const birthDate = new Date(newChildBirthDate);
      const childrenRef = collection(db, 'users', user.uid, 'children');
      await addDoc(childrenRef, {
        name: newChildName,
        birthDate: Timestamp.fromDate(birthDate),
      });
      setNewChildName('');
      setNewChildBirthDate('');
      fetchData();
      toast({ title: "¡Hijo añadido!", description: "Se ha guardado correctamente el perfil." });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'children', childId));
      fetchData();
      toast({ title: "Perfil eliminado", description: "Se ha borrado el perfil del niño." });
    } catch (error) {
      console.error(error);
    }
  };

  const handleRegister = async () => {
    if (!user || !upcomingMeeting || !userData) return;

    try {
      const meetingDate = upcomingMeeting.date.toDate();
      const childrenToRegister = children
        .filter(c => selectedChildren.includes(c.id))
        .map(c => {
          const ageMonths = calculateAgeInMonths(c.birthDate.toDate(), meetingDate);
          const group = upcomingMeeting.ageGroups.find(g => ageMonths >= g.minMonths && ageMonths < g.maxMonths);
          return {
            childId: c.id,
            name: c.name,
            birthDate: c.birthDate,
            ageGroupLabel: group ? group.label : "Sin grupo"
          };
        });

      const regRef = doc(db, 'meetings', upcomingMeeting.id, 'registrations', user.uid);
      await setDoc(regRef, {
        parentName: userData.displayName,
        parentEmail: userData.email,
        children: childrenToRegister,
        registeredAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
      });

      toast({ 
        title: "¡Inscripción confirmada!", 
        description: `Has inscrito a ${childrenToRegister.length} hijos para la reunión.` 
      });
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la inscripción." });
    }
  };

  const toggleChildSelection = (childId: string) => {
    setSelectedChildren(prev => 
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    );
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
            <Baby className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-primary">CongreKids</h1>
          <p className="text-muted-foreground text-lg">
            Bienvenido a la plataforma de gestión de guardería de la Congregación Mater Salvatoris. Inicia sesión para gestionar tus inscripciones.
          </p>
          <Button size="lg" onClick={login} className="w-full text-lg h-14">
            Iniciar sesión con Google
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Baby className="text-primary" /> Mis Hijos
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)
            ) : (
              <>
                {children.map(child => (
                  <Card key={child.id} className="group overflow-hidden border-primary/10 hover:border-primary/30 transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{child.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteChild(child.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardDescription>
                        Nacido el {formatDate(child.birthDate)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-xs font-medium px-2 py-1 bg-primary/5 text-primary rounded-full inline-block">
                        {Math.floor(calculateAgeInMonths(child.birthDate.toDate(), new Date()) / 12)} años
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center space-y-4 hover:bg-primary/5 transition-colors cursor-pointer border-2" 
                      onClick={() => document.getElementById('new-child-form')?.scrollIntoView({ behavior: 'smooth' })}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Plus className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium">Añadir perfil de hijo</p>
                </Card>
              </>
            )}
          </div>

          <Card id="new-child-form" className="mt-8 max-w-lg">
            <CardHeader>
              <CardTitle className="text-lg">Nuevo Hijo</CardTitle>
              <CardDescription>Añade los datos de nacimiento para calcular el grupo de edad.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddChild}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Ej. Juan Pérez" 
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                  <Input 
                    id="birthDate" 
                    type="date" 
                    value={newChildBirthDate}
                    onChange={(e) => setNewChildBirthDate(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">Guardar Perfil</Button>
              </CardFooter>
            </form>
          </Card>
        </section>

        {/* Meeting Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <CalendarIcon className="text-primary" />
            <h2 className="text-2xl font-bold">Próxima Reunión</h2>
          </div>

          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : upcomingMeeting ? (
            <Card className="border-primary/20 bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl text-primary">{upcomingMeeting.title}</CardTitle>
                    <CardDescription className="text-lg flex items-center gap-2 mt-1">
                      <CalendarIcon className="w-4 h-4" />
                      {formatDate(upcomingMeeting.date)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-start md:items-end">
                    <span className="text-sm font-medium text-muted-foreground">Plazo límite de inscripción:</span>
                    <span className="text-sm font-bold">{formatDate(upcomingMeeting.registrationDeadline)} 23:59h</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isRegistrationOpen(upcomingMeeting.registrationDeadline.toDate()) ? (
                  <div className="space-y-6">
                    <div className="bg-accent/10 p-4 rounded-lg flex gap-3 items-start">
                      <AlertCircle className="text-accent shrink-0 mt-0.5" />
                      <p className="text-sm">
                        Selecciona los niños que asistirán. Calcularemos su grupo de edad automáticamente según la fecha de la reunión.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {children.length === 0 ? (
                        <p className="text-sm text-muted-foreground col-span-2 italic">Primero debes añadir perfiles de tus hijos arriba.</p>
                      ) : (
                        children.map(child => (
                          <div 
                            key={child.id} 
                            className={`flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer ${
                              selectedChildren.includes(child.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                            }`}
                            onClick={() => toggleChildSelection(child.id)}
                          >
                            <Checkbox 
                              checked={selectedChildren.includes(child.id)}
                              onCheckedChange={() => toggleChildSelection(child.id)}
                              className="w-5 h-5"
                            />
                            <div className="flex-1">
                              <p className="font-bold leading-none">{child.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {Math.floor(calculateAgeInMonths(child.birthDate.toDate(), upcomingMeeting.date.toDate()))} meses el día de la reunión
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-destructive/10 p-6 rounded-lg text-center flex flex-col items-center gap-2">
                    <AlertCircle className="text-destructive w-8 h-8" />
                    <p className="text-lg font-bold text-destructive">Plazo cerrado</p>
                    <p className="text-sm">Lo sentimos, el plazo de inscripción para esta reunión ha finalizado.</p>
                  </div>
                )}
              </CardContent>
              {isRegistrationOpen(upcomingMeeting.registrationDeadline.toDate()) && children.length > 0 && (
                <CardFooter className="flex flex-col gap-4">
                  <Button onClick={handleRegister} size="lg" className="w-full md:w-auto h-12 px-12 text-lg">
                    {registration ? 'Actualizar inscripción' : 'Confirmar asistencia'}
                  </Button>
                  {registration && (
                    <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      ¡Ya estás inscrito! Puedes modificar tu elección hasta que cierre el plazo.
                    </div>
                  )}
                </CardFooter>
              )}
            </Card>
          ) : (
            <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/20">
              <p className="text-muted-foreground">No hay reuniones próximas programadas.</p>
            </div>
          )}
        </section>

        {/* History Placeholder */}
        <section className="pb-12">
          <div className="flex items-center gap-2 mb-6">
            <History className="text-primary" />
            <h2 className="text-2xl font-bold">Mi Historial</h2>
          </div>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>Aquí aparecerán tus inscripciones pasadas próximamente.</p>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
}

// Helper for server timestamp on client side (using Firestore export)
const serverTimestamp = () => Timestamp.now();
