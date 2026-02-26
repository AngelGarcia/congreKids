
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar as CalendarIcon, AlertCircle, Baby, Users, Heart, ShieldCheck, ArrowRight, Clock, Search, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { collection, query, where, orderBy, limit, doc, Timestamp, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDate, formatDateTime, isRegistrationOpen, calculateAgeInMonths, getRegistrationOpeningDate, isTooEarlyForRegistration } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';

export default function ParentDashboard() {
  const { user, userData, familyData, login, joinFamily, createFamily, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  // UI State
  const [selectedRole, setSelectedRole] = useState<'padre' | 'madre'>('padre');
  const [step, setStep] = useState<'role' | 'search' | 'confirm'>('role');
  
  // Forms state
  const [familySurnames, setFamilySurnames] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundFamilies, setFoundFamilies] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

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
    }
  }, [registration]);

  const handleSearchFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familySurnames.trim()) return;

    setIsSearching(true);
    try {
      const q = query(
        collection(db, 'families'), 
        where('name', '==', `Familia ${familySurnames.trim()}`)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Obtenemos los miembros de cada familia para diferenciarlas
        const familiesWithMembers = await Promise.all(snap.docs.map(async (docSnap) => {
          const famData = { id: docSnap.id, ...docSnap.data() };
          const mQ = query(collection(db, 'users'), where('familyId', '==', docSnap.id));
          const mSnap = await getDocs(mQ);
          return { ...famData, membersList: mSnap.docs.map(d => d.data()) };
        }));
        setFoundFamilies(familiesWithMembers);
      } else {
        setFoundFamilies([]);
      }
      setStep('confirm');
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la búsqueda." });
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black text-primary text-2xl uppercase tracking-tighter">Cargando CongreKids...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8">
          <Baby className="w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black text-primary tracking-tighter mb-4">CongreKids</h1>
        <p className="text-xl text-muted-foreground max-w-sm mb-12 font-medium">Gestiona el cuidado infantil de tu parroquia de forma sencilla.</p>
        <Button size="lg" onClick={login} className="w-full max-w-xs h-16 text-xl rounded-2xl shadow-xl font-black">
          Entrar con Google
        </Button>
      </div>
    );
  }

  if (!userData?.familyId) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md rounded-3xl border-4 border-primary/10 shadow-2xl overflow-hidden">
          <CardHeader className="text-center space-y-2 bg-primary/5 pb-8">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary mx-auto mb-4 shadow-sm border">
              <Users className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black uppercase tracking-tighter">Bienvenido</CardTitle>
            <CardDescription className="text-base font-bold">Configura tu unidad familiar para empezar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            
            {step === 'role' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Label className="text-xs font-black uppercase text-primary tracking-widest block text-center">Primero, ¿cuál es tu rol?</Label>
                <RadioGroup value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)} className="flex gap-3">
                  <div className="flex-1">
                    <RadioGroupItem value="padre" id="padre" className="peer sr-only" />
                    <Label
                      htmlFor="padre"
                      className="flex flex-col items-center justify-center h-24 rounded-2xl border-2 border-muted bg-popover hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                    >
                      <span className="text-base font-black uppercase">Padre</span>
                    </Label>
                  </div>
                  <div className="flex-1">
                    <RadioGroupItem value="madre" id="madre" className="peer sr-only" />
                    <Label
                      htmlFor="madre"
                      className="flex flex-col items-center justify-center h-24 rounded-2xl border-2 border-muted bg-popover hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                    >
                      <span className="text-base font-black uppercase">Madre</span>
                    </Label>
                  </div>
                </RadioGroup>
                <Button onClick={() => setStep('search')} className="w-full h-14 rounded-xl font-black text-lg shadow-lg">SIGUIENTE</Button>
              </div>
            )}

            {step === 'search' && (
              <form onSubmit={handleSearchFamily} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase text-primary tracking-widest block text-center">Apellidos de tu Familia</Label>
                  <Input 
                    placeholder="Ej. García Medina" 
                    value={familySurnames}
                    onChange={e => setFamilySurnames(e.target.value)}
                    required
                    className="h-14 rounded-xl border-2 font-bold text-center text-lg"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground text-center font-bold italic">Buscaremos si tu pareja ya ha creado la familia.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button type="submit" disabled={isSearching} className="h-14 rounded-xl font-black text-lg shadow-lg">
                    {isSearching ? <Loader2 className="animate-spin" /> : 'BUSCAR COINCIDENCIAS'}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep('role')} className="text-xs font-black uppercase text-muted-foreground">Volver</Button>
                </div>
              </form>
            )}

            {step === 'confirm' && (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                {foundFamilies.length > 0 ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-xs font-black uppercase text-primary tracking-widest italic mb-4">¿Alguna de estas es tu familia?</p>
                      <div className="space-y-3">
                        {foundFamilies.map((fam) => (
                          <div key={fam.id} className="bg-primary/5 p-5 rounded-2xl border-2 border-primary/20 text-left hover:bg-primary/10 transition-colors">
                            <h3 className="text-lg font-black uppercase tracking-tighter leading-none mb-2">{fam.name}</h3>
                            <div className="flex items-center justify-between">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {fam.membersList.map((m: any, i: number) => (
                                  <div key={i} className="inline-block h-6 w-6 rounded-full border-2 border-white bg-primary/20 flex items-center justify-center text-[8px] font-black uppercase">
                                    {m.displayName?.[0]}
                                  </div>
                                ))}
                                <span className="ml-3 text-[10px] font-bold text-muted-foreground self-center">
                                  {fam.membersList.map((m: any) => m.displayName?.split(' ')[0]).join(' y ')}
                                </span>
                              </div>
                              <Button size="sm" onClick={() => joinFamily(fam.id, selectedRole)} className="rounded-lg h-8 px-4 font-black uppercase text-[10px]">
                                UNIRME
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                      <div className="relative flex justify-center text-[10px] font-black uppercase"><span className="bg-white px-2 text-muted-foreground">O también</span></div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button variant="outline" onClick={() => createFamily(familySurnames, selectedRole)} className="h-14 rounded-xl font-black text-xs uppercase border-2 border-primary text-primary hover:bg-primary/5">
                        NO, CREAR NUEVA FAMILIA {familySurnames.toUpperCase()}
                      </Button>
                      <Button variant="ghost" onClick={() => setStep('search')} className="text-[10px] font-black uppercase text-muted-foreground">Volver a buscar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <div className="bg-muted/10 p-8 rounded-[2rem] border-2 border-dashed border-muted-foreground/30 space-y-2">
                      <p className="text-xs font-black uppercase text-muted-foreground tracking-widest italic">Nueva Unidad Familiar</p>
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Familia {familySurnames}</h3>
                      <p className="text-sm font-bold text-muted-foreground">No hemos encontrado ninguna familia con estos apellidos.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button onClick={() => createFamily(familySurnames, selectedRole)} className="h-16 rounded-2xl font-black text-lg shadow-xl uppercase tracking-tighter">
                        CREAR ESTA FAMILIA
                      </Button>
                      <Button variant="ghost" onClick={() => setStep('search')} className="text-xs font-black uppercase text-muted-foreground">Corregir apellidos</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    );
  }

  const registrationOpeningDate = upcomingMeeting ? getRegistrationOpeningDate((upcomingMeeting.date as any).toDate()) : null;
  const isRegistrationCurrentlyOpen = upcomingMeeting ? isRegistrationOpen((upcomingMeeting.registrationDeadline as any).toDate(), registrationOpeningDate) : false;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Navbar />
      <main className="container mx-auto px-4 py-12 space-y-12 max-w-4xl">
        
        {/* Admin Quick Access */}
        {userData.isAdmin && (
          <div className="flex justify-center -mt-4 mb-4">
            <Link href="/admin" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
              <ShieldCheck className="w-3 h-3" />
              Área de Administración
            </Link>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter uppercase text-primary drop-shadow-sm">
            {familyData?.name || '...'}
          </h1>
          <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Unidad Familiar</p>
        </div>

        {/* Meeting Section */}
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
                <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl text-primary font-black leading-tight uppercase tracking-tighter">
                    {upcomingMeeting.title}
                  </CardTitle>
                  <Badge className="bg-primary text-white font-black px-4 py-1 text-xs rounded-full uppercase">Siguiente</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-base font-bold text-muted-foreground">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDateTime(upcomingMeeting.date)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] bg-destructive/10 text-destructive self-start px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" />
                    Plazo hasta: {formatDate(upcomingMeeting.registrationDeadline)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isRegistrationCurrentlyOpen ? (
                  <div className="space-y-4">
                    <div className="bg-muted/30 p-4 rounded-xl border-l-4 border-primary">
                      <p className="text-sm font-bold text-foreground italic">"Selecciona a los peques que vendrán"</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {(!sortedChildren || sortedChildren.length === 0) ? (
                        <div className="py-8 text-center border-2 border-dashed rounded-2xl bg-muted/5 space-y-3">
                          <p className="text-muted-foreground font-bold text-sm px-6">Para inscribir a tus hijos, primero debes añadirlos en tu perfil familiar.</p>
                          <Button asChild variant="outline" size="sm" className="rounded-xl font-black uppercase tracking-tighter text-[10px]">
                            <Link href="/family">Gestionar Familia</Link>
                          </Button>
                        </div>
                      ) : (
                        sortedChildren.map(child => {
                          const ageMonths = calculateAgeInMonths((child.birthDate as any).toDate(), (upcomingMeeting.date as any).toDate());
                          const isSelected = selectedChildren.includes(child.id);
                          return (
                            <div 
                              key={child.id} 
                              className={`flex items-center space-x-4 p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                                isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-white hover:border-primary/10'
                              }`}
                              onClick={() => {
                                setSelectedChildren(prev => 
                                  isSelected ? prev.filter(id => id !== child.id) : [...prev, child.id]
                                );
                              }}
                            >
                              <Checkbox 
                                checked={isSelected}
                                className="w-6 h-6 rounded-lg border-2 data-[state=checked]:bg-primary"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1">
                                <p className="text-lg font-black leading-none mb-1">{child.name}</p>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                  {ageMonths >= 12 ? `${Math.floor(ageMonths / 12)} años` : `${ageMonths} meses`}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-6">
                    <AlertCircle className="text-destructive w-12 h-12 mx-auto" />
                    <p className="text-xl font-black text-destructive uppercase tracking-tighter">Inscripciones Cerradas</p>
                    <p className="text-xs text-muted-foreground font-bold">El plazo para esta reunión ha finalizado.</p>
                  </div>
                )}
              </CardContent>
              {isRegistrationCurrentlyOpen && sortedChildren && sortedChildren.length > 0 && (
                <CardFooter className="p-6 pt-0 flex flex-col gap-4">
                  <Button onClick={handleRegister} className="w-full h-14 text-lg rounded-2xl font-black shadow-xl uppercase tracking-tighter">
                    {registration ? 'Actualizar Inscripción' : 'Confirmar Asistencia'}
                  </Button>
                  {registration && (
                    <div className="flex items-center gap-2 text-green-600 font-black justify-center bg-green-50 p-2 rounded-xl w-full border border-green-100">
                      <Heart className="w-4 h-4 fill-green-600" />
                      <span className="text-[10px] uppercase tracking-widest">Inscripción guardada correctamente</span>
                    </div>
                  )}
                </CardFooter>
              )}
            </Card>
          ) : (
            <div className="py-24 text-center border-4 border-dashed rounded-[2.5rem] bg-muted/10">
              <p className="text-muted-foreground font-black text-xl uppercase opacity-40">No hay reuniones próximas programadas</p>
            </div>
          )}
        </section>

        {/* Family Summary Card */}
        <section className="pt-8">
          <Card className="rounded-3xl border-2 bg-muted/5 border-dashed hover:bg-white transition-all group overflow-hidden">
            <Link href="/family" className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Mi Familia</h3>
                  <p className="text-xs font-medium text-muted-foreground">
                    {children?.length || 0} hijos registrados • Gestionar perfiles y pareja
                  </p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
            </Link>
          </Card>
        </section>

      </main>
    </div>
  );
}
