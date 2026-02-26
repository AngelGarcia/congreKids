
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, limit, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { Calendar, Users, ArrowRight, UserCheck, Clock, Home, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [stats, setStats] = useState({ upcoming: 0, total: 0, totalFamilies: 0 });
  const [loading, setLoading] = useState(true);
  const [nextMeetingId, setNextMeetingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const now = new Date();
        // Fetch Meetings
        const q = query(collection(db, 'meetings'), orderBy('date', 'desc'), limit(10));
        const snap = await getDocs(q);
        const meetingsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMeetings(meetingsList);

        // Identificar la próxima reunión (la más cercana al futuro)
        const upcomingList = meetingsList
          .filter(m => (m.date as any).toDate() >= now)
          .sort((a, b) => (a.date as any).toDate().getTime() - (b.date as any).toDate().getTime());
        
        if (upcomingList.length > 0) {
          setNextMeetingId(upcomingList[0].id);
        }

        // Fetch Stats
        const allMeetingsSnap = await getDocs(collection(db, 'meetings'));
        const upcomingCount = allMeetingsSnap.docs.filter(d => (d.data().date as any).toDate() >= now).length;
        
        const familiesSnap = await getDocs(collection(db, 'families'));

        setStats({
          upcoming: upcomingCount,
          total: allMeetingsSnap.size,
          totalFamilies: familiesSnap.size
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Resumen General</h1>
        <p className="text-muted-foreground font-medium">Control de actividad y próximas reuniones de la congregación.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-b-4 border-b-primary shadow-lg rounded-2xl overflow-hidden hover:bg-primary/5 transition-colors cursor-pointer group">
          <Link href="/admin/meetings">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-primary/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Próximas</CardTitle>
              <Clock className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent className="pt-4 flex justify-between items-end">
              <div>
                {loading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-black">{stats.upcoming}</div>}
                <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">Reuniones programadas</p>
              </div>
              <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Link>
        </Card>

        <Card className="border-b-4 border-b-accent shadow-lg rounded-2xl overflow-hidden hover:bg-accent/5 transition-colors cursor-pointer group">
          <Link href="/admin/families">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-accent/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-accent">Familias</CardTitle>
              <Users className="w-5 h-5 text-accent" />
            </CardHeader>
            <CardContent className="pt-4 flex justify-between items-end">
              <div>
                {loading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-black">{stats.totalFamilies}</div>}
                <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">Unidades familiares registradas</p>
              </div>
              <ArrowRight className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Link>
        </Card>

        <Card className="border-b-4 border-b-muted-foreground shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Historial</CardTitle>
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-black">{stats.total}</div>}
            <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">Total reuniones creadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="rounded-2xl shadow-xl border-none">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 p-6">
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tighter">Actividad Reciente</CardTitle>
              <CardDescription className="font-medium">Últimas reuniones programadas o realizadas.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="font-bold rounded-xl border-2">
              <Link href="/admin/meetings">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/5">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-black uppercase text-xs">Título</TableHead>
                  <TableHead className="font-black uppercase text-xs">Fecha</TableHead>
                  <TableHead className="font-black uppercase text-xs">Estado</TableHead>
                  <TableHead className="text-right font-black uppercase text-xs">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [1, 2, 3].map(i => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  meetings.map((meeting) => {
                    const now = new Date();
                    const isPast = (meeting.date as any).toDate() < now;
                    const isNext = meeting.id === nextMeetingId;
                    
                    let statusLabel = "Pasada";
                    let badgeVariant: "secondary" | "default" | "outline" | "destructive" = "secondary";
                    
                    if (!isPast) {
                      if (isNext) {
                        const deadline = (meeting.registrationDeadline as any).toDate();
                        if (now > deadline || meeting.status === 'closed') {
                          statusLabel = "CERRADA";
                          badgeVariant = "destructive";
                        } else {
                          statusLabel = "ABIERTA";
                          badgeVariant = "default";
                        }
                      } else {
                        statusLabel = "Programada";
                        badgeVariant = "outline";
                      }
                    }

                    return (
                      <TableRow key={meeting.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="font-bold py-4">{meeting.title}</TableCell>
                        <TableCell className="font-medium">{formatDate(meeting.date)}</TableCell>
                        <TableCell>
                          <Badge variant={badgeVariant} className="rounded-lg font-black uppercase px-3">
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon" className="hover:bg-primary/10 text-primary">
                            <Link href={`/admin/meetings/${meeting.id}`}>
                              <ArrowRight className="w-5 h-5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {!loading && meetings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16 text-muted-foreground font-bold italic">
                      Todavía no has creado ninguna reunión.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-4">
        <Button asChild size="lg" className="h-16 px-12 rounded-2xl text-lg font-black shadow-xl uppercase tracking-tighter">
          <Link href="/admin/meetings/new">
            <Calendar className="mr-2 h-6 w-6" />
            Programar Nueva Reunión
          </Link>
        </Button>
      </div>
    </div>
  );
}
