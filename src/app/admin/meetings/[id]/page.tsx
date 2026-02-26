"use client";

import { useEffect, useState, use } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, updateDoc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { Download, FileDown, Lock, ChevronLeft, Unlock } from 'lucide-react';
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

          // Comprobar si es la próxima reunión
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
      ['Padre/Madre', 'Email', 'Nombre Hijo', 'Grupo Edad', 'F. Nacimiento']
    ];

    registrations.forEach(reg => {
      reg.children.forEach((child: any) => {
        rows.push([
          reg.parentName,
          reg.parentEmail,
          child.name,
          child.ageGroupLabel,
          child.birthDate.toDate().toLocaleDateString()
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

  const now = new Date();
  const isPast = (meeting.date as any).toDate() < now;
  const deadline = (meeting.registrationDeadline as any).toDate();
  const hasPassedDeadline = now > deadline;

  let statusText = "Pasada";
  let badgeVariant: "secondary" | "default" | "outline" | "destructive" = "secondary";
  
  if (!isPast) {
    if (isNextMeeting) {
      if (hasPassedDeadline || meeting.status === 'closed') {
        statusText = "CERRADA";
        badgeVariant = "destructive";
      } else {
        statusText = "ABIERTA";
        badgeVariant = "default";
      }
    } else {
      statusText = "Programada";
      badgeVariant = "outline";
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/admin/meetings" className="text-sm text-muted-foreground flex items-center hover:text-primary mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
          <div className="text-muted-foreground flex items-center gap-3">
            {formatDate(meeting.date)}
            <Badge variant={badgeVariant} className="font-black uppercase">
              {statusText}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {!isPast && isNextMeeting && (
            <Button variant="outline" size="sm" onClick={handleToggleStatus}>
              {meeting.status === 'closed' ? (
                <><Unlock className="w-4 h-4 mr-2" /> Abrir Plazo</>
              ) : (
                <><Lock className="w-4 h-4 mr-2" /> Cerrar Plazo</>
              )}
            </Button>
          )}
          <Button size="sm" onClick={exportToCSV}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Resumen por grupos de edad si existen registros */}
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
            <Card key={group} className="border-primary/20">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">{group}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-3xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">Niños registrados</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Niños</CardTitle>
          <CardDescription>Total de {registrations.reduce((acc, r) => acc + r.children.length, 0)} niños inscritos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre del Niño</TableHead>
                <TableHead>Grupo de Edad</TableHead>
                <TableHead>Padre / Madre</TableHead>
                <TableHead>F. Nacimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.flatMap((reg) => 
                reg.children.map((child: any, idx: number) => (
                  <TableRow key={`${reg.id}-${idx}`}>
                    <TableCell className="font-medium">{child.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{child.ageGroupLabel || 'Sin grupo'}</Badge>
                    </TableCell>
                    <TableCell>{reg.parentName}</TableCell>
                    <TableCell>{formatDate(child.birthDate)}</TableCell>
                  </TableRow>
                ))
              )}
              {registrations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                    Todavía no hay inscripciones para esta reunión.
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