
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { Home, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function FamiliesManagement() {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        const q = query(collection(db, 'families'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        setFamilies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching families:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFamilies();
  }, []);

  const filteredFamilies = families.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Familias Registradas</h1>
        <p className="text-muted-foreground font-medium">Listado completo de unidades familiares por apellidos.</p>
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

      <Card className="rounded-2xl shadow-xl border-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-black uppercase text-xs">Familia (Apellidos)</TableHead>
                <TableHead className="font-black uppercase text-xs">Miembros Adultos</TableHead>
                <TableHead className="font-black uppercase text-xs">Fecha de Registro</TableHead>
                <TableHead className="font-black uppercase text-xs">ID Familia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredFamilies.map((family) => (
                  <TableRow key={family.id} className="hover:bg-primary/5 transition-colors h-16">
                    <TableCell className="font-bold text-lg">
                      {family.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{family.members?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      {formatDate(family.createdAt)}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono text-muted-foreground">
                        {family.id}
                      </code>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!loading && filteredFamilies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-muted-foreground font-bold italic">
                    No se han encontrado familias con ese nombre.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
