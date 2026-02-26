"use client";

import { useEffect, useState, use } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, updateDoc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { Download, FileDown, Lock, ChevronLeft, Unlock, Settings2, Baby, Music } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [meeting, setMeeting] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNextMeeting, setIsNextMeeting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const mDoc = await getDoc(doc(db, 'meetings', id));
        if (mDoc.exists()) {
          const data = { id: mDoc.id, ...mDoc.data() };
          setMeeting(data);

          const now = new Date();
          const q = query(
            collection(db, 'meetings'),
            where('date', '>=', Timestamp.fromDate(now)),
            orderBy('date', 'asc'),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty && snap.docs[0].id === id) {
            setIsNextMeeting(true);
          }
        }

        const rSnap = await getDocs(collection(db, 'meetings', id, 'registrations'));
        setRegistrations(rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'meetings/' + id,
          operation: 'get'
        }));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleToggleStatus = async () => {
    const newStatus = meeting.status === 'closed' ? 'upcoming' : 'closed';
    updateDoc(doc(db, 'meetings', id), { status: newStatus })
      .then(() => {
        setMeeting({ ...meeting, status: newStatus });
        toast({ 
          title: newStatus === 'closed' ? "Plazo cerrado" : "Plazo abierto", 
          description: newStatus === 'closed' ? "Ya no se aceptan más inscripciones." : "Se han vuelto a habilitar las inscripciones." 
        });
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'meetings/' + id,
          operation: 'update',
          requestResourceData: { status: newStatus }
        }));
      });
  };

  const exportToCSV = () => {
    const rows = [
      ['Padre/Madre', 'Email', 'Nombre Hijo', 'Grupo Edad', 'F. Nacimiento', 'Familia', 'Guitarra']
    ];

    registrations.forEach(reg => {
      reg.children.forEach((child: any) => {
        rows.push([
          reg.parentName,
          reg.parentEmail,
          child.name,
          child.ageGroupLabel,
          child.birthDate.toDate().toLocaleDateString(),
          reg.familyName || '',
          child.guitarSelected ? 'SI' : 'NO'
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inscripciones_${meeting?.title || 'reunion'}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (loading) return <div className="p-8">Cargando detalles de la reunión...</div>;
  if (!meeting) return <div className="p-8">Reunión no encontrada.</div>;

  const guitarCount = registrations.reduce((acc, reg) => 
    acc + reg.children.filter((c: any) => c.guitarSelected).length, 0
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/admin/meetings" className="text-sm text-muted-foreground flex items-center hover:text-primary mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
          <h1 className="text-3xl font-bold tracking-tight uppercase tracking-tighter">{meeting.title}</h1>
          <div className="text-muted-foreground flex items-center gap-3">
            {formatDate(meeting.date)}
          </div>
        </div>
        <div className="flex gap-2">
          {!isNextMeeting && (
            <Button variant="outline" size="sm" onClick={handleToggleStatus} className="rounded-xl font-bold uppercase">
              {meeting.status === 'closed' ? <><Unlock className="w-4 h-4 mr-2" /> Abrir</> : <><Lock className="w-4 h-4 mr-2" /> Cerrar</>}
            </Button>
          )}
          <Button size="sm" onClick={exportToCSV} className="rounded-xl font-bold uppercase">
            <FileDown className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-accent/40 bg-accent/5 rounded-2xl shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <Music className="w-3 h-3" /> Clase Guitarra
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-4xl font-black text-accent">{guitarCount}</div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Niños apuntados</p>
            </CardContent>
          </Card>
          
          {Object.keys(registrations.reduce((acc: any, reg) => {
            reg.children.forEach((c: any) => {
              acc[c.ageGroupLabel || 'Sin grupo'] = true;
            });
            return acc;
          }, {})).map((group) => {
            const count = registrations.reduce((acc, reg) => 
              acc + reg.children.filter((c: any) => (c.ageGroupLabel || 'Sin grupo') === group).length, 0
            );
            return (
              <Card key={group} className="border-primary/20 rounded-2xl shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-primary">{group}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-4xl font-black">{count}</div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Registrados</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-2xl border-2 border-dashed bg-muted/5">
          <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-xs font-black uppercase tracking-widest">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {meeting.ageGroups?.map((group: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase">{group.label}</span>
                  {group.allowsGuitar && <Music className="w-3 h-3 text-accent" />}
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {group.minMonths / 12} a {group.maxMonths / 12} años
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border overflow-hidden">
        <CardHeader className="bg-muted/5 border-b">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Baby className="w-5 h-5 text-primary" /> Listado de Niños
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Nombre del Niño</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Categoría</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Extra</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Familia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.flatMap((reg) => 
                reg.children.map((child: any, idx: number) => (
                  <TableRow key={`${reg.id}-${idx}`} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="font-black py-4">{child.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-lg font-black uppercase text-[9px] border-primary/20 text-primary">
                        {child.ageGroupLabel || 'Sin grupo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {child.guitarSelected && (
                        <Badge className="bg-accent text-white font-black uppercase text-[9px] rounded-lg">
                          <Music className="w-3 h-3 mr-1" /> GUITARRA
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-bold uppercase text-muted-foreground">{reg.familyName || 'Sin apellidos'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
