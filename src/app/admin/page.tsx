"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, onSnapshot, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { Calendar, Users, ArrowRight, Clock, ShieldCheck, CheckCircle2, AlertCircle, Baby } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AdminDashboard() {
  const { userData } = useAuth();
  const [nextMeeting, setNextMeeting] = useState<any>(null);
  const [nextMeetingStats, setNextMeetingStats] = useState({ childCount: 0 });
  const [stats, setStats] = useState({ upcoming: 0, total: 0, totalFamilies: 0, totalChildren: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Solo intentar cargar si sabemos que es admin
    if (!userData?.isAdmin) return;

    const fetchDashboardData = async () => {
      try {
        const now = new Date();
        
        // Fetch Meetings
        const meetingsRef = collection(db, 'meetings');
        const allMeetingsSnap = await getDocs(meetingsRef).catch(err => {
          throw new FirestorePermissionError({ path: 'meetings', operation: 'list' });
        });

        const allMeetings = allMeetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const upcomingMeetings = allMeetings
          .filter((m: any) => (m.date as any).toDate() >= now)
          .sort((a: any, b: any) => (a.date as any).toDate().getTime() - (b.date as any).toDate().getTime());
        
        // Fetch Families
        const familiesRef = collection(db, 'families');
        const familiesSnap = await getDocs(familiesRef).catch(err => {
           throw new FirestorePermissionError({ path: 'families', operation: 'list' });
        });
        
        // Fetch All Children (Collection Group)
        const childrenGroupRef = collectionGroup(db, 'children');
        const childrenSnap = await getDocs(childrenGroupRef).catch(err => {
           throw new FirestorePermissionError({ path: 'children (group)', operation: 'list' });
        });

        setStats({
          upcoming: upcomingMeetings.length,
          total: allMeetingsSnap.size,
          totalFamilies: familiesSnap.size,
          totalChildren: childrenSnap.size
        });

        if (upcomingMeetings.length > 0) {
          const next = upcomingMeetings[0];
          setNextMeeting(next);

          // Fetch child count for this next meeting
          const regSnap = await getDocs(collection(db, 'meetings', next.id, 'registrations'));
          let count = 0;
          regSnap.forEach(doc => {
            const data = doc.data();
            if (data.children) count += data.children.length;
          });
          setNextMeetingStats({ childCount: count });
        }
      } catch (error: any) {
        if (error instanceof FirestorePermissionError) {
          errorEmitter.emit('permission-error', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [userData]);

  const getStatus = (meeting: any) => {
    if (!meeting) return null;
    const now = new Date();
    const deadline = (meeting.registrationDeadline as any).toDate();
    const isClosed = now > deadline || meeting.status === 'closed';
    
    return {
      label: isClosed ? 'CERRADA' : 'ABIERTA',
      variant: isClosed ? 'destructive' : 'default',
      icon: isClosed ? <AlertCircle className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />
    };
  };

  const status = getStatus(nextMeeting);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Resumen General</h1>
        <p className="text-muted-foreground font-medium text-lg">Control de actividad y próximas reuniones de la congregación.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-b-4 border-b-primary shadow-lg rounded-2xl overflow-hidden hover:bg-primary/5 transition-colors cursor-pointer group">
          <Link href="/admin/families">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-primary/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Niños Totales</CardTitle>
              <Baby className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent className="pt-4 flex justify-between items-end">
              <div>
                {loading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-black">{stats.totalChildren}</div>}
                <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">Censo infantil actual</p>
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
                <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">Unidades familiares</p>
              </div>
              <ArrowRight className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Link>
        </Card>

        <Card className="border-b-4 border-b-muted-foreground shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Reuniones</CardTitle>
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-black">{stats.total}</div>}
            <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">Encuentros en el historial</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Próxima Reunión
        </h2>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-[2.5rem]" />
        ) : nextMeeting ? (
          <Card className="rounded-[2.5rem] shadow-2xl border-none overflow-hidden group">
            <div className="flex flex-col lg:flex-row">
              <div className={`p-10 lg:w-2/3 flex flex-col justify-between transition-colors duration-500 ${status?.label === 'CERRADA' ? 'bg-slate-600 text-white' : 'bg-primary text-white'}`}>
                <div className="space-y-6">
                  <Badge variant="secondary" className="bg-white/20 text-white border-none font-black uppercase px-4 py-1.5 text-xs tracking-widest">
                    {status?.icon}
                    {status?.label}
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                      {nextMeeting.title}
                    </h3>
                    <p className="text-xl font-medium opacity-80">
                      {formatDateTime(nextMeeting.date)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-10 flex items-center gap-6">
                   <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Plazo límite</span>
                    <span className="text-sm font-bold">{formatDateTime(nextMeeting.registrationDeadline)}</span>
                  </div>
                </div>
              </div>

              <div className="p-10 lg:w-1/3 bg-white flex flex-col justify-between border-y lg:border-y-0 lg:border-l">
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Estado de Inscripción</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-primary">{nextMeetingStats.childCount}</span>
                    <span className="text-xl font-bold text-muted-foreground">niños</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium pt-2">Registrados hasta el momento para esta reunión.</p>
                </div>

                <Button asChild size="lg" className="w-full h-16 rounded-2xl font-black text-base uppercase shadow-xl mt-8">
                  <Link href={`/admin/meetings/${nextMeeting.id}`}>
                    Ver Listado de Niños
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-20 text-center border-4 border-dashed rounded-[2.5rem] bg-muted/10">
            <p className="text-muted-foreground font-black uppercase text-xl opacity-40 italic">No hay ninguna reunión programada próximamente.</p>
            <Button asChild variant="outline" className="mt-6 rounded-xl font-black uppercase border-2">
              <Link href="/admin/meetings/new">Crear Calendario</Link>
            </Button>
          </Card>
        )}
      </div>

      <div className="flex justify-center pt-6">
        <Button asChild size="lg" variant="outline" className="h-14 px-8 rounded-xl text-sm font-black border-2 uppercase tracking-tighter">
          <Link href="/admin/meetings">
            <Calendar className="mr-2 h-5 w-5" />
            Gestionar Todo el Calendario
          </Link>
        </Button>
      </div>
    </div>
  );
}
