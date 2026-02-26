
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, DocumentData } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { Users, Baby, Search, ChevronDown, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function FamilyChildrenList({ familyId }: { familyId: string }) {
  const db = useFirestore();
  const childrenQuery = useMemoFirebase(() => {
    if (!db || !familyId) return null;
    return collection(db, 'families', familyId, 'children');
  }, [db, familyId]);

  const { data: children, isLoading } = useCollection(childrenQuery);

  if (isLoading) return <Skeleton className="h-10 w-full rounded-lg" />;
  if (!children || children.length === 0) return <p className="text-xs text-muted-foreground italic p-2">No hay hijos registrados.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
      {children.map(child => (
        <div key={child.id} className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
          <Baby className="w-5 h-5 text-primary" />
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
  const [searchTerm, setSearchTerm] = useState('');

  // Queries for families and all users to map names
  const familiesQuery = useMemoFirebase(() => query(collection(db, 'families'), orderBy('name', 'asc')), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);

  const { data: families, isLoading: loadingFamilies } = useCollection(familiesQuery);
  const { data: users, isLoading: loadingUsers } = useCollection(usersQuery);

  const filteredFamilies = families?.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getFamilyAdults = (familyId: string) => {
    return users
      ?.filter(u => u.familyId === familyId)
      .map(u => u.displayName || u.email)
      .join(' y ') || 'Sin adultos registrados';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Familias Registradas</h1>
        <p className="text-muted-foreground font-medium">Gestión de unidades familiares, padres e hijos.</p>
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

      <div className="space-y-4">
        {loadingFamilies || loadingUsers ? (
          [1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))
        ) : filteredFamilies.length === 0 ? (
          <div className="text-center py-20 bg-muted/10 rounded-3xl border-3 border-dashed">
            <p className="text-muted-foreground font-black uppercase text-xl opacity-40">No se han encontrado familias</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {filteredFamilies.map((family) => (
              <AccordionItem 
                key={family.id} 
                value={family.id}
                className="bg-white rounded-2xl shadow-sm border px-6 hover:shadow-md transition-shadow"
              >
                <AccordionTrigger className="hover:no-underline py-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full text-left gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Home className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{family.name}</h3>
                        <p className="text-sm font-medium text-muted-foreground mt-1">
                          {getFamilyAdults(family.id)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 pr-4">
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Registrada</p>
                        <p className="text-xs font-bold">{formatDate(family.createdAt)}</p>
                      </div>
                      <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black px-4">
                        {family.members?.length || 0} ADULTOS
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <div className="pt-2 border-t space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Baby className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest text-primary">Listado de Hijos</span>
                    </div>
                    <FamilyChildrenList familyId={family.id} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
