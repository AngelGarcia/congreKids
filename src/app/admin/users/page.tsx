
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShieldCheck, User, ArrowUpCircle, ArrowDownCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function UsersManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'padre' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ 
        title: "Rol actualizado", 
        description: `El usuario ahora es ${newRole}.` 
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No tienes permisos para cambiar roles." });
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Usuarios y Permisos</h1>
        <p className="text-muted-foreground font-medium">Gestiona quién tiene acceso a las herramientas de administración de la congregación.</p>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <Search className="text-muted-foreground w-5 h-5 ml-2" />
        <Input 
          placeholder="Buscar por nombre o email..." 
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
                <TableHead className="font-black uppercase text-xs w-[300px]">Usuario</TableHead>
                <TableHead className="font-black uppercase text-xs">Email</TableHead>
                <TableHead className="font-black uppercase text-xs">Rol Actual</TableHead>
                <TableHead className="text-right font-black uppercase text-xs">Acción Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="h-20 animate-pulse bg-muted/5" />
                  </TableRow>
                ))
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-primary/5 transition-colors h-20">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/10">
                          <AvatarImage src={user.photoURL || ''} />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">
                            {user.displayName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold">{user.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className="rounded-lg font-black uppercase px-3">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant={user.role === 'admin' ? 'destructive' : 'default'} 
                        size="sm"
                        onClick={() => toggleAdmin(user.id, user.role)}
                        className="rounded-xl font-bold uppercase"
                      >
                        {user.role === 'admin' ? (
                          <><ArrowDownCircle className="w-4 h-4 mr-2" /> Quitar Admin</>
                        ) : (
                          <><ArrowUpCircle className="w-4 h-4 mr-2" /> Hacer Admin</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!loading && filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-muted-foreground font-bold italic">
                    No se han encontrado usuarios con ese criterio.
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
