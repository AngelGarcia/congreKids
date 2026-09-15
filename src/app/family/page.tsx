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
 * Icono dinámico basado en género (Bebé universal con color).
 */
function ChildAvatarIcon({ gender }: { gender: string }) {
  const isGirl = gender === 'niña';
  const colorClass = isGirl ? 'text-pink-500' : 'text-blue-500';
  const bgColorClass = isGirl ? 'bg-pink-100' : 'bg-blue-100';

  return (
    <div className={cn("w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-sm shrink-0 border-2", bgColorClass, isGirl ? 'border-pink-200' : 'border-blue-200', colorClass)}>
      <Baby className="w-7 h-7" />
    </div>
  );
}

export default function FamilyManagement() {
  const { user, userData, familyData, familyMembers, updateFamilyName, loading: authLoading, logout } = useAuth();
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

  useEffect(() => {
    if (!authLoading && (!user || !userData?.familyId)) {
      router.push('/');
    }
  }, [user, userData, authLoading, router]);

  useEffect(() => {
    if (familyData?.name) {
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
    toast({ title: "¡Hijo añadido!", description: "Perfil familiar actualizado." });
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
    toast({ title: "Perfil actualizado", description: "Los cambios se han guardado." });
  };

  const handleUpdateFamilyName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFamilySurnames.trim()) {
      updateFamilyName(`Familia ${editFamilySurnames.trim()}`);
      setIsEditingFamilyName(false);
    }
  };

  const handleDeleteChild = (childId: string) => {
    if (!userData?.familyId || !db) return;
    const childDocRef = doc(db, 'families', userData.familyId, 'children', childId);
    deleteDocumentNonBlocking(childDocRef);
    toast({ title: "Hijo eliminado", description: "Registro borrado." });
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black text-primary text-2xl uppercase tracking-tighter">CongreKids...</div>;
  if (!user || !userData?.familyId) return null;

  const sortedMembers = [...familyMembers].sort((a, b) => {
    if (a.role === 'padre') return -1;
    if (b.role === 'madre') return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-12 max-w-4xl">
        
        <Link href="/" className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors active:scale-95">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver atrás
        </Link>

        {/* Family Tree Header Section */}
        <section className="flex flex-col items-center text-center space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="space-y-1.5 px-4 w-full">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {isEditingFamilyName ? (
                <form onSubmit={handleUpdateFamilyName} className="flex items-center gap-2 w-full max-w-sm">
                  <Input 
                    value={editFamilySurnames} 
                    onChange={e => setEditFamilySurnames(e.target.value)}
                    className="h-14 text-xl font-black border-2 rounded-2xl text-center"
                    autoFocus
                  />
                  <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl shrink-0 shadow-lg"><Check /></Button>
                </form>
              ) : (
                <>
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase text-primary leading-tight break-words">
                    {familyData?.name || '...'}
                  </h1>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingFamilyName(true)} className="text-muted-foreground hover:text-primary active:scale-90">
                    <Edit2 className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.4em]">Configuración Familiar</p>
          </div>

          <div className="flex items-center justify-center gap-8 sm:gap-12 relative w-full overflow-x-auto pb-4 px-4 no-scrollbar">
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[60%] h-1 bg-primary/10 -z-10 rounded-full" />
            
            {sortedMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative">
                  <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-white shadow-2xl">
                    <AvatarImage src={member.photoURL || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-2xl uppercase">
                      {member.role?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  {member.isAdmin && (
                    <div className="absolute -top-1 -right-1 bg-accent text-white p-1.5 rounded-xl shadow-lg border-2 border-white">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <Badge className="text-[8px] font-black uppercase px-2 mb-1 bg-primary/10 text-primary border-none">{member.role}</Badge>
                  <p className="text-xs font-bold text-foreground leading-none">{member.displayName?.split(' ')[0]}</p>
                </div>
              </div>
            ))}

            {familyMembers.length < 2 && (
              <div className="flex flex-col items-center gap-3 opacity-40 grayscale shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-dashed border-primary/20 bg-primary/5 text-primary flex items-center justify-center">
                  <UserPlus className="w-8 h-8 opacity-20" />
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="text-[8px] font-black uppercase px-2 mb-1">Pendiente</Badge>
                  <p className="text-xs font-bold text-muted-foreground leading-none italic">Sin cónyuge</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Children Section */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <div className="flex flex-col items-center gap-1.5">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tighter flex items-center gap-2.5">
              <Baby className="text-primary w-5 h-5 sm:w-6 sm:h-6" /> Nuestros Hijos
            </h2>
            <div className="w-10 h-1 bg-primary/20 rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loadingChildren ? (
              [1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-[2rem]" />)
            ) : (
              <>
                {sortedChildren.map(child => {
                  const ageMonths = calculateAgeInMonths((child.birthDate as any).toDate(), new Date());
                  return (
                    <Card key={child.id} className="relative overflow-hidden border-none shadow-xl rounded-[2rem] bg-white group active:scale-[0.98] transition-all">
                      <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-4">
                          <ChildAvatarIcon gender={child.gender} />
                          <div>
                            <CardTitle className="text-lg font-black">{child.name}</CardTitle>
                            <CardDescription className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                              {formatDate(child.birthDate)}
                            </CardDescription>
                            <div className="flex gap-2 mt-2">
                              <Badge className="px-2.5 py-0.5 text-[9px] rounded-lg bg-primary/5 text-primary border-none font-black uppercase tracking-tighter">
                                {ageMonths >= 12 ? `${Math.floor(ageMonths / 12)} años` : `${ageMonths} meses`}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={() => handleEditClick(child)}
                            className="h-9 w-9 text-muted-foreground hover:text-primary rounded-xl bg-muted/30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={() => handleDeleteChild(child.id)}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-xl bg-muted/30"
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
                  onClick={() => { setIsAddingChild(true); setEditingChild(null); setNewChildGender('niño'); }}
                  className="h-32 w-full border-dashed border-2 border-primary/20 rounded-[2rem] bg-muted/5 flex flex-col gap-3 hover:bg-white hover:border-primary/40 active:scale-[0.98] transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-md border-2 border-primary/5">
                    <Plus className="w-7 h-7" />
                  </div>
                  <span className="font-black text-[10px] text-primary uppercase tracking-[0.2em]">Añadir hijo</span>
                </Button>
              </>
            )}
          </div>

          {(isAddingChild || editingChild) && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center animate-in fade-in duration-300">
              <Card className="w-full max-w-md shadow-2xl border-none rounded-[2.5rem] overflow-hidden animate-in slide-in-from-bottom-20 sm:slide-in-from-bottom-0 duration-500">
                <CardHeader className="bg-primary/5 p-6 flex flex-row items-center justify-between border-b">
                  <div className="flex items-center gap-3 text-primary">
                    <Baby className="w-5 h-5" />
                    <CardTitle className="text-lg font-black uppercase tracking-tighter">
                      {editingChild ? 'Editar Perfil' : 'Nuevo Perfil'}
                    </CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => { setIsAddingChild(false); setEditingChild(null); }} 
                    className="rounded-full h-10 w-10 active:scale-90"
                  >
                    <X />
                  </Button>
                </CardHeader>
                <form onSubmit={editingChild ? handleUpdateChild : handleAddChild}>
                  <CardContent className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Nombre</Label>
                      <Input 
                        placeholder="Ej. Pablo" 
                        value={newChildName}
                        onChange={(e) => setNewChildName(e.target.value)}
                        required
                        className="h-14 text-lg rounded-2xl border-2 bg-muted/10 focus:bg-white focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Fecha de nacimiento</Label>
                      <Input 
                        type="date" 
                        value={newChildBirthDate}
                        onChange={(e) => setNewChildBirthDate(e.target.value)}
                        required
                        className="h-14 text-lg rounded-2xl border-2 bg-muted/10 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Género</Label>
                      <RadioGroup 
                        value={newChildGender} 
                        onValueChange={(val: any) => setNewChildGender(val)}
                        className="flex gap-4"
                      >
                        <div className="flex-1">
                          <RadioGroupItem value="niño" id="gender-boy" className="sr-only" />
                          <Label
                            htmlFor="gender-boy"
                            className={cn(
                              "flex flex-col items-center justify-center h-20 rounded-2xl border-2 transition-all cursor-pointer font-black text-xs uppercase tracking-widest",
                              newChildGender === 'niño' ? "border-blue-500 bg-blue-50 text-blue-600 shadow-inner" : "border-muted bg-white text-muted-foreground opacity-60"
                            )}
                          >
                            <Baby className="w-6 h-6 mb-1" />
                            Niño
                          </Label>
                        </div>
                        <div className="flex-1">
                          <RadioGroupItem value="niña" id="gender-girl" className="sr-only" />
                          <Label
                            htmlFor="gender-girl"
                            className={cn(
                              "flex flex-col items-center justify-center h-20 rounded-2xl border-2 transition-all cursor-pointer font-black text-xs uppercase tracking-widest",
                              newChildGender === 'niña' ? "border-pink-500 bg-pink-50 text-pink-600 shadow-inner" : "border-muted bg-white text-muted-foreground opacity-60"
                            )}
                          >
                            <Baby className="w-6 h-6 mb-1" />
                            Niña
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 sm:p-8 pt-0 flex gap-3">
                    <Button variant="ghost" onClick={() => { setIsAddingChild(false); setEditingChild(null); }} className="flex-1 h-14 rounded-2xl font-bold uppercase text-xs">Cancelar</Button>
                    <Button type="submit" className="flex-[2] h-14 text-base rounded-2xl font-black shadow-2xl uppercase tracking-tighter">
                      {editingChild ? <><Save className="w-4 h-4 mr-2" /> Guardar</> : 'Añadir Hijo'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
