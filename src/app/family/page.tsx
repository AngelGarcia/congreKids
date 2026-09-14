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
import { Plus, Trash2, Baby, X, UserPlus, ShieldCheck, Edit2, Check, ChevronLeft, Save } from 'lucide-react';
import { collection, doc, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { formatDate, calculateAgeInMonths } from '@/lib/utils/date';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

/**
 * Icono infantil minimalista y limpio integrado con el estilo de Lucide.
 */
function ChildFaceIcon({ gender, className }: { gender: string, className?: string }) {
  const isGirl = gender === 'niña';
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10.5h.01" strokeWidth="3" />
      <path d="M15 10.5h.01" strokeWidth="3" />
      <path d="M9 14.5a3.5 3.5 0 0 0 6 0" />
      {isGirl ? (
        <>
          <path d="M4 9c-1-0.8-1.5-0.5-1.5 1v2" />
          <path d="M20 9c1-0.8 1.5-0.5 1.5 1v2" />
        </>
      ) : (
        <path d="M11 3c0.5 1 1.5 1 2 0" />
      )}
    </svg>
  );
}

/**
 * Icono dinámico basado en género y edad para la vista familiar.
 */
function ChildAvatarIcon({ gender, birthDate }: { gender: string, birthDate: any }) {
  const date = birthDate instanceof Date ? birthDate : (birthDate as any).toDate();
  const ageMonths = calculateAgeInMonths(date, new Date());
  const isBaby = ageMonths < 18;
  const isGirl = gender === 'niña';
  
  const colorClass = isGirl ? 'text-pink-500' : 'text-blue-500';
  const bgColorClass = isGirl ? 'bg-pink-100' : 'bg-blue-100';

  return (
    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shadow-sm shrink-0", bgColorClass, colorClass)}>
      {isBaby ? (
        <Baby className="w-7 h-7" />
      ) : (
        <ChildFaceIcon gender={gender} className="w-6 h-6" />
      )}
    </div>
  );
}

export default function FamilyManagement() {
  const { user, userData, familyData, familyMembers, updateFamilyName, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  // UI State
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [editingChild, setEditingChild] = useState<any>(null);
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  
  // Forms state
  const [newChildName, setNewChildName] = useState('');
  const [newChildBirthDate, setNewChildBirthDate] = useState('');
  const [newChildGender, setNewChildGender] = useState<'niño' | 'niña'>('niño');
  const [editFamilySurnames, setEditFamilySurnames] = useState('');

  // Redirección si no hay usuario (tras logout)
  useEffect(() => {
    if (!authLoading && (!user || !userData?.familyId)) {
      router.push('/');
    }
  }, [user, userData, authLoading, router]);

  useEffect(() => {
    if (familyData?.name) {
      // Extraemos solo los apellidos si el nombre empieza por "Familia "
      const surnames = familyData.name.startsWith('Familia ') 
        ? familyData.name.replace('Familia ', '') 
        : familyData.name;
      setEditFamilySurnames(surnames);
    }
  }, [familyData]);

  const childrenQuery = useMemoFirebase(() => {
    if (!db || !userData?.familyId || !user) return null;
    return collection(db, 'families', userData.familyId, 'children');
  }, [db, userData?.familyId, user]);

  const { data: children, isLoading: loadingChildren } = useCollection(childrenQuery);

  const sortedChildren = children ? [...children].sort((a, b) => {
    const dateA = a.birthDate instanceof Date ? a.birthDate : (a.birthDate as any).toDate();
    const dateB = b.birthDate instanceof Date ? b.birthDate : (b.birthDate as any).toDate();
    return dateA.getTime() - dateB.getTime();
  }) : [];

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.familyId || !newChildName || !newChildBirthDate || !childrenQuery) return;

    const birthDate = new Date(newChildBirthDate);
    addDocumentNonBlocking(childrenQuery, {
      familyId: userData.familyId,
      name: newChildName,
      birthDate: Timestamp.fromDate(birthDate),
      gender: newChildGender
    });
    
    setNewChildName('');
    setNewChildBirthDate('');
    setNewChildGender('niño');
    setIsAddingChild(false);
    toast({ title: "¡Hijo añadido!", description: "Ahora es visible para ambos padres." });
  };
  
  const handleEditClick = (child: any) => {
    setEditingChild(child);
    setNewChildName(child.name);
    const date = child.birthDate instanceof Date ? child.birthDate : (child.birthDate as any).toDate();
    setNewChildBirthDate(date.toISOString().split('T')[0]);
    setNewChildGender(child.gender || 'niño');
    setIsAddingChild(false);
  };

  const handleUpdateChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.familyId || !editingChild || !newChildName || !newChildBirthDate || !db) return;

    const birthDate = new Date(newChildBirthDate);
    const childDocRef = doc(db, 'families', userData.familyId, 'children', editingChild.id);
    
    updateDocumentNonBlocking(childDocRef, {
      name: newChildName,
      birthDate: Timestamp.fromDate(birthDate),
      gender: newChildGender
    });
    
    setEditingChild(null);
    setNewChildName('');
    setNewChildBirthDate('');
    setNewChildGender('niño');
    toast({ title: "Perfil actualizado", description: "Los cambios se han guardado correctamente." });
  };

  const handleUpdateFamilyName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFamilySurnames.trim()) {
      // Siempre guardamos con el prefijo "Familia "
      updateFamilyName(`Familia ${editFamilySurnames.trim()}`);
      setIsEditingFamilyName(false);
    }
  };

  const handleDeleteChild = (childId: string) => {
    if (!userData?.familyId || !db) return;
    const childDocRef = doc(db, 'families', userData.familyId, 'children', childId);
    deleteDocumentNonBlocking(childDocRef);
    toast({ title: "Perfil eliminado", description: "Se ha borrado el registro del niño." });
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black text-primary text-2xl uppercase tracking-tighter">CongreKids...</div>;
  if (!user || !userData?.familyId) return null;

  const sortedMembers = [...familyMembers].sort((a, b) => {
    if (a.role === 'padre') return -1;
    if (b.role === 'padre') return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-12 max-w-4xl">
        
        <Link href="/" className="inline-flex items-center text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver a Inscripciones
        </Link>

        {/* Family Tree Header Section */}
        <section className="flex flex-col items-center text-center space-y-10">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              {isEditingFamilyName ? (
                <form onSubmit={handleUpdateFamilyName} className="flex items-center gap-3 max-w-xl">
                  <span className="text-3xl font-black uppercase text-primary whitespace-nowrap">Familia</span>
                  <Input 
                    value={editFamilySurnames} 
                    onChange={e => setEditFamilySurnames(e.target.value)}
                    className="h-14 text-2xl font-black border-2 rounded-xl"
                    autoFocus
                  />
                  <Button type="submit" size="icon" className="h-14 w-14 rounded-xl shrink-0"><Check /></Button>
                </form>
              ) : (
                <>
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase text-primary">
                    {familyData?.name || '...'}
                  </h1>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingFamilyName(true)} className="text-muted-foreground hover:text-primary">
                    <Edit2 className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Unidad Familiar</p>
          </div>

          <div className="flex items-center justify-center gap-10 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-1 bg-primary/5 -z-10 rounded-full" />
            
            {sortedMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-2">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-white shadow-xl">
                    <AvatarImage src={member.photoURL || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-2xl uppercase">
                      {member.role?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  {member.isAdmin && (
                    <div className="absolute -top-1 -right-1 bg-accent text-white p-1.5 rounded-lg shadow-lg">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest">{member.role}</span>
                  <span className="text-sm font-bold text-foreground">{member.displayName?.split(' ')[0]}</span>
                </div>
              </div>
            ))}

            {familyMembers.length < 2 && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-primary/20 bg-primary/5 text-primary shadow-inner flex items-center justify-center">
                  <UserPlus className="w-8 h-8 opacity-20" />
                </div>
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Esperando pareja</span>
              </div>
            )}
          </div>
        </section>

        {/* Children Section */}
        <section className="space-y-8">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Baby className="text-primary w-6 h-6" /> Nuestros Hijos
            </h2>
            <div className="w-12 h-1 bg-primary/20 rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingChildren ? (
              [1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)
            ) : (
              <>
                {sortedChildren.map(child => {
                  const ageMonths = calculateAgeInMonths((child.birthDate as any).toDate(), new Date());
                  return (
                    <Card key={child.id} className="relative overflow-hidden border-2 border-primary/5 hover:border-primary/20 transition-all shadow-md rounded-3xl bg-white group">
                      <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-4">
                          <ChildAvatarIcon gender={child.gender} birthDate={child.birthDate} />
                          <div>
                            <CardTitle className="text-xl font-black">{child.name}</CardTitle>
                            <CardDescription className="text-xs font-bold text-muted-foreground">
                              {formatDate(child.birthDate)}
                            </CardDescription>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className="px-3 py-0.5 text-[10px] rounded-lg bg-primary/10 text-primary border-none font-black">
                                {ageMonths >= 12 ? `${Math.floor(ageMonths / 12)} años` : `${ageMonths} meses`}
                              </Badge>
                              <Badge variant="outline" className="px-3 py-0.5 text-[10px] rounded-lg border-primary/20 text-primary font-black uppercase">
                                {child.gender}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEditClick(child)}
                            className="h-9 w-9 text-muted-foreground hover:text-primary rounded-xl"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteChild(child.id)}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
                
                <Button 
                  variant="outline" 
                  onClick={() => { setIsAddingChild(true); setEditingChild(null); }}
                  className="h-32 w-full border-dashed border-2 rounded-3xl flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="font-black text-xs text-primary uppercase tracking-widest">Añadir hijo</span>
                </Button>
              </>
            )}
          </div>

          {(isAddingChild || editingChild) && (
            <Card className="shadow-2xl border-2 border-primary/10 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-w-lg mx-auto">
              <CardHeader className="bg-primary/5 p-6 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-black uppercase tracking-tighter">
                  {editingChild ? 'Editar Perfil' : 'Nuevo Perfil'}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => { setIsAddingChild(false); setEditingChild(null); }} 
                  className="rounded-full h-10 w-10"
                >
                  <X />
                </Button>
              </CardHeader>
              <form onSubmit={editingChild ? handleUpdateChild : handleAddChild}>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nombre</Label>
                    <Input 
                      id="name" 
                      placeholder="Ej. Pablo" 
                      value={newChildName}
                      onChange={(e) => setNewChildName(e.target.value)}
                      required
                      className="h-12 text-base rounded-xl border-2 bg-muted/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fecha de nacimiento</Label>
                    <Input 
                      id="birthDate" 
                      type="date" 
                      value={newChildBirthDate}
                      onChange={(e) => setNewChildBirthDate(e.target.value)}
                      required
                      className="h-12 text-base rounded-xl border-2 bg-muted/20"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Género</Label>
                    <RadioGroup 
                      value={newChildGender} 
                      onValueChange={(val: any) => setNewChildGender(val)}
                      className="flex gap-4"
                    >
                      <div className="flex-1">
                        <RadioGroupItem value="niño" id="gender-boy" className="peer sr-only" />
                        <Label
                          htmlFor="gender-boy"
                          className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-muted bg-popover hover:bg-accent peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 transition-all cursor-pointer font-black uppercase text-xs"
                        >
                          <Baby className="w-4 h-4 text-blue-500" /> Niño
                        </Label>
                      </div>
                      <div className="flex-1">
                        <RadioGroupItem value="niña" id="gender-girl" className="peer sr-only" />
                        <Label
                          htmlFor="gender-girl"
                          className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-muted bg-popover hover:bg-accent peer-data-[state=checked]:border-pink-500 peer-data-[state=checked]:bg-pink-50 transition-all cursor-pointer font-black uppercase text-xs"
                        >
                          <Baby className="w-4 h-4 text-pink-500" /> Niña
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button type="submit" className="w-full h-12 text-base rounded-xl font-black shadow-lg uppercase tracking-tighter">
                    {editingChild ? <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</> : 'Guardar Hijo'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </section>

      </main>
    </div>
  );
}