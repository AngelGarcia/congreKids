"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, onSnapshot, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { Calendar, Users, ArrowRight, Clock, ShieldCheck, CheckCircle2, AlertCircle, Baby, CalendarDays, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const { userData } = useAuth();
  const [nextMeeting, setNextMeeting] = useState<any>(null);
  const [nextMeetingStats, setNextMeetingStats] = useState({ childCount: 0 });
  const [stats, setStats] = useState({ upcoming: 0, total: 0, totalFamilies: 0, totalChildren: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.isAdmin) return;

    const fetchDashboardData = async () => {
      try {
        const now = new Date();
        
        const meetingsRef = collection(db, 'meetings');
        const allMeetingsSnap = await getDocs(meetingsRef).catch(err => {
          throw new FirestorePermissionError({ path: 'meetings', operation: 'list' });
        });

        const allMeetings = allMeetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const upcomingMeetings = allMeetings
          .filter((m: any) => (m.date as any).toDate() >= now)
          .sort((a: any, b: any) => (a.date as any).toDate().getTime() - (b.date as any).toDate().getTime());
        
        const familiesRef = collection(db, 'families');
        const familiesSnap = await getDocs(familiesRef).catch(err => {
           throw new FirestorePermissionError({ path: 'families', operation: 'list' });
        });
        
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
      icon: isClosed ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />
    };
  };

  const status = getStatus(nextMeeting);
  const isCalendarLow = stats.upcoming <= 2;

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

        <Card className={cn(
          "border-b-4 shadow-lg rounded-2xl overflow-hidden transition-colors cursor-pointer group",
          isCalendarLow && !loading ? "border-b-destructive bg-destructive/5 hover:bg-destructive/10" : "border-b-slate-400 bg-slate-50 hover:bg-slate-100"
        )}>
          <Link href="/admin/meetings">
            <CardHeader className={cn(
              "flex flex-row items-center justify-between pb-2",
              isCalendarLow && !loading ? "bg-destructive/10" : "bg-slate-100"
            )}>
              <CardTitle className={cn(
                "text-sm font-black uppercase tracking-widest",
                isCalendarLow && !loading ? "text-destructive" : "text-slate-600"
              )}>Programación</CardTitle>
              <Calendar className={cn(
                "w-5 h-5",
                isCalendarLow && !loading ? "text-destructive" : "text-slate-600"
              )} />
            </CardHeader>
            <CardContent className="pt-4 flex justify-between items-end">
              <div>
                <div className="flex items-baseline gap-2">
                  {loading ? <Skeleton className="h-10 w-20" /> : <div className={cn("text-4xl font-black", isCalendarLow && "text-destructive")}>{stats.upcoming}</div>}
                  <span className="text-[10px] font-black uppercase opacity-60">Próximas</span>
                </div>
                {isCalendarLow && !loading && (
                  <p className="text-[10px] text-destructive font-black mt-1 uppercase flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3 h-3" /> ¡Programar más!
                  </p>
                )}
                {!isCalendarLow && !loading && (
                  <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Calendario al día</p>
                )}
              </div>
              <ArrowRight className={cn(
                "w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity",
                isCalendarLow ? "text-destructive" : "text-slate-600"
              )} />
            </CardContent>
          </Link>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="w-5 h-5" />
          <h2 className="text-sm font-black uppercase tracking-widest">Siguiente Encuentro</h2>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-[2.5rem]" />
        ) : nextMeeting ? (
          <Card className={`border-none shadow-2xl rounded-[2.5rem] overflow-hidden text-white transition-colors duration-500 ${status?.label === 'CERRADA' ? 'bg-slate-600' : 'bg-primary'}`}>
            <CardContent className="p-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="space-y-4 text-center md:text-left">
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-none font-black uppercase px-4 py-1.5">
                    {status?.icon}
                    {status?.label}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/10 text-white border-none font-black uppercase px-4 py-1.5">
                    <Baby className="w-3 h-3 mr-1" /> {nextMeetingStats.childCount} Niños
                  </Badge>
                </div>
                <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                  {nextMeeting.title}
                </h3>
                <p className="text-xl font-medium opacity-90">
                  {formatDateTime(nextMeeting.date)}
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <Button asChild size="lg" className="h-16 px-8 bg-white text-primary hover:bg-white/90 rounded-2xl font-black text-lg uppercase tracking-tighter shadow-xl">
                  <Link href={`/admin/meetings/${nextMeeting.id}`}>
                    Ver detalles de la reunión
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <p className="text-[10px] text-center font-black uppercase opacity-60">
                  Plazo inscripción: {formatDate(nextMeeting.registrationDeadline)}
                </p>
              </div>
            </CardContent>
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
