"use client";

import { useState } from 'react';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '@/components/ui/badge';
import { formatDate, calculateAgeInMonths } from '@/lib/utils/date';
import { Baby, Search, Home, Users, AlertTriangle, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { normalizeString, cleanSurnames } from '@/lib/utils/string';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from '@/lib/utils';

/**
 * Icono infantil minimalista y limpio con distinción de género (coletas para niñas).
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
          <circle cx="2.5" cy="10" r="1.5" fill="currentColor" />
          <circle cx="21.5" cy="10" r="1.5" fill="currentColor" />
        </>
      ) : (
        <path d="M11 3c0.5 1 1.5 1 2 0" />
      )}
    </svg>
  );
}

/**
 * Icono dinámico basado en género y edad (Bebé < 18 meses).
 */
function ChildAvatarIcon({ gender, birthDate }: { gender: string, birthDate: any }) {
  const date = birthDate instanceof Date ? birthDate : (birthDate as any).toDate();
  const ageMonths = calculateAgeInMonths(date, new Date());
  const isBaby = ageMonths < 18;
  const isGirl = gender === 'niña';
  
  const colorClass = isGirl ? 'text-pink-500' : 'text-blue-500';
  const bgColorClass = isGirl ? 'bg-pink-100' : 'bg-blue-100';

  return (
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-sm shrink-0", bgColorClass, colorClass)}>
      {isBaby ? (
        <Baby className="w-6 h-6" />
      ) : (
        <ChildFaceIcon gender={gender} className="w-6 h-6" />
      )}
    </div>
  );
}

/**
 * Componente para mostrar el listado de hijos de una familia específica.
 */
function FamilyChildrenList({ familyId }: { familyId: string }) {
  const db = useFirestore();
  const childrenQuery = useMemoFirebase(() => {
    if (!db || !familyId) return null;
    return collection(db, 'families', familyId, 'children');
  }, [db, familyId]);

  const { data: children, isLoading } = useCollection(childrenQuery);

  if (isLoading) return <Skeleton className="h-10 w-full rounded-lg" />;
  if (!children || children.length === 0) return <p className="text-xs text-muted-foreground italic p-2">No hay hijos registrados.</p>;

  // Ordenar hijos de mayor a menor (fecha de nacimiento más antigua primero)
  const sortedChildren = [...children].sort((a, b) => {
    const dateA = a.birthDate instanceof Date ? a.birthDate : (a.birthDate as any).toDate();
    const dateB = b.birthDate instanceof Date ? b.birthDate : (b.birthDate as any).toDate();
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
      {sortedChildren.map(child => (
        <div key={child.id} className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
          <ChildAvatarIcon gender={child.gender} birthDate={child.birthDate} />
          <div>
            <p className="font-bold text-sm">{child.name}</p>
            <p className="text-[10px] uppercase font-black text-muted-foreground">
              {formatDate(child.birthDate)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FamiliesManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFixing, setIsFixing] = useState(false);

  // Consultas para familias y todos los usuarios
  const familiesQuery = useMemoFirebase(() => query(collection(db, 'families'), orderBy('name', 'asc')), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);

  const { data: families, isLoading: loadingFamilies } = useCollection(familiesQuery);
  const { data: users, isLoading: loadingUsers } = useCollection(usersQuery);

  const filteredFamilies = families?.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const familiesWithMissingIndex = families?.filter(f => !f.searchName) || [];

  const handleFixIndices = async () => {
    if (!families || familiesWithMissingIndex.length === 0) return;
    
    setIsFixing(true);
    let count = 0;
    
    try {
      for (const family of familiesWithMissingIndex) {
        const surnames = cleanSurnames(family.name);
        const searchName = normalizeString(surnames);
        
        updateDocumentNonBlocking(doc(db, 'families', family.id), { 
          searchName: searchName 
        });
        count++;
      }
      toast({ 
        title: "Índices reparados", 
        description: `Se han actualizado ${count} familias para que sean encontrables.` 
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsFixing(false);
    }
  };

  /**
   * Obtiene los nombres de los adultos de la familia.
   */
  const getFamilyAdults = (family: any) => {
    if (loadingUsers || !users) return [];
    return users.filter(u => family.members?.includes(u.id) || u.familyId === family.id);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Familias Registradas</h1>
          <p className="text-muted-foreground font-medium">Gestión de unidades familiares, padres e hijos de la congregación.</p>
        </div>

        {familiesWithMissingIndex.length > 0 && (
          <Button 
            onClick={handleFixIndices} 
            disabled={isFixing}
            className="rounded-2xl h-14 px-8 font-black uppercase tracking-tighter shadow-xl bg-amber-500 hover:bg-amber-600 animate-pulse hover:animate-none"
          >
            {isFixing ? (
              <Wand2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="w-5 h-5 mr-2" />
            )}
            Reparar {familiesWithMissingIndex.length} índices
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <Search className="text-muted-foreground w-5 h-5 ml-2" />
        <Input 
          placeholder="Buscar familia por apellidos..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0 text-lg font-medium"
        />
      </div>

      {familiesWithMissingIndex.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-800 uppercase">
            Se han detectado {familiesWithMissingIndex.length} familias que no aparecen en las búsquedas de los padres. Pulsa el botón superior para repararlas.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {loadingFamilies ? (
          [1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))
        ) : filteredFamilies.length === 0 ? (
          <div className="text-center py-20 bg-muted/10 rounded-3xl border-3 border-dashed">
            <p className="text-muted-foreground font-black uppercase text-xl opacity-40">No se han encontrado familias</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {filteredFamilies.map((family) => {
              const adults = getFamilyAdults(family);
              const isBroken = !family.searchName;

              return (
                <AccordionItem 
                  key={family.id} 
                  value={family.id}
                  className={`bg-white rounded-2xl shadow-sm border px-6 hover:shadow-md transition-shadow border-b-0 ${isBroken ? 'border-amber-200 bg-amber-50/20' : ''}`}
                >
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full text-left gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isBroken ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                          {isBroken ? <AlertTriangle className="w-6 h-6" /> : <Home className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{family.name}</h3>
                            {isBroken && <Badge variant="destructive" className="text-[8px] font-black uppercase">Invisible</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <p className="text-sm font-bold text-muted-foreground">
                              {adults.length > 0 ? adults.map(u => u.displayName).join(' y ') : 'Sin miembros registrados'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pr-4">
                        <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black px-4 h-8 uppercase tracking-widest">
                          Ver Hijos
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <div className="pt-2 border-t space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Baby className="w-4 h-4 text-primary" />
                        <span className="text-xs font-black uppercase tracking-widest text-primary">Hijos (ordenados por edad)</span>
                      </div>
                      <FamilyChildrenList familyId={family.id} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
