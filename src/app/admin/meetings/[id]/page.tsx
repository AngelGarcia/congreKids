"use client";

import { useEffect, useState, use } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { Download, FileDown, Lock, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [meeting, setMeeting] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const mDoc = await getDoc(doc(db, 'meetings', id));
      if (mDoc.exists()) {
        setMeeting({ id: mDoc.id, ...mDoc.data() });
      }

      const rSnap = await getDocs(collection(db, 'meetings', id, 'registrations'));
      setRegistrations(rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleCloseRegistration = async () => {
    try {
      await updateDoc(doc(db, 'meetings', id), { status: 'closed' });
      setMeeting({ ...meeting, status: 'closed' });
      toast({ title: "Plazo cerrado", description: "Ya no se aceptan más inscripciones." });
    } catch (error) {
      console.error(error);
    }
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

  // Group children by age group for summary
  const groupedChildren: Record<string, any[]> = {};
  registrations.forEach(reg => {
    reg.children.forEach((child: any) => {
      const group = child.ageGroupLabel || 'Sin grupo';
      if (!groupedChildren[group]) groupedChildren[group] = [];
      groupedChildren[group].push({ ...child, parentName: reg.parentName });
    });
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/admin" className="text-sm text-muted-foreground flex items-center hover:text-primary mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
          <div className="text-muted-foreground flex items-center gap-2">
            {formatDate(meeting.date)}
            <Badge variant={meeting.status === 'upcoming' ? 'default' : 'secondary'}>
              {meeting.status === 'upcoming' ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {meeting.status === 'upcoming' && (
            <Button variant="outline" size="sm" onClick={handleCloseRegistration}>
              <Lock className="w-4 h-4 mr-2" />
              Cerrar Plazo
            </Button>
          )}
          <Button size="sm" onClick={exportToCSV}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Object.entries(groupedChildren).map(([group, list]) => (
          <Card key={group} className="border-primary/20">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">{group}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-3xl font-bold">{list.length}</div>
              <p className="text-xs text-muted-foreground">Niños registrados</p>
            </CardContent>
          </Card>
        ))}
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
              {Object.entries(groupedChildren).flatMap(([group, list]) => 
                list.map((child, idx) => (
                  <TableRow key={`${group}-${idx}`}>
                    <TableCell className="font-medium">{child.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{group}</Badge>
                    </TableCell>
                    <TableCell>{child.parentName}</TableCell>
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
