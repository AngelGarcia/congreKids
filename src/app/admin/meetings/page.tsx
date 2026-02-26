"use client";

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { ArrowRight, Calendar, Plus, Clock, History, CalendarDays, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function MeetingsAdmin() {
  const db = useFirestore();
  const meetingsQuery = useMemoFirebase(() => query(collection(db, 'meetings'), orderBy('date', 'desc')), [db]);
  const { data: meetings, isLoading } = useCollection(meetingsQuery);

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-80 w-full" /></div>;

  const now = new Date();
  
  // Separar reuniones
  const upcoming = meetings?.filter(m => (m.date as any).toDate() >= now).reverse() || [];
  const past = meetings?.filter(m => (m.date as any).toDate() < now) || [];

  const nextMeeting = upcoming[0];
  const otherFuture = upcoming.slice(1);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Gestión de Reuniones</h1>
          <p className="text-muted-foreground font-medium text-lg">Organización de encuentros y grupos de guardería.</p>
        </div>
        <Button asChild size="lg" className="rounded-2xl font-black uppercase tracking-tighter shadow-xl">
          <Link href="/admin/meetings/new">
            <Plus className="w-5 h-5 mr-2" />
            Nueva Reunión
          </Link>
        </Button>
      </div>

      {/* PRÓXIMA REUNIÓN (HERO) */}
      {nextMeeting ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Siguiente Encuentro</h2>
          </div>
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-primary text-white">
            <CardContent className="p-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="space-y-4 text-center md:text-left">
                <Badge variant="secondary" className="bg-white/20 text-white border-none font-black uppercase px-4 py-1">Inscripciones Abiertas</Badge>
                <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                  {nextMeeting.title}
                </h3>
                <p className="text-xl font-medium opacity-90">
                  {formatDateTime(nextMeeting.date)}
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <Button asChild size="xl" className="h-16 px-8 bg-white text-primary hover:bg-white/90 rounded-2xl font-black text-lg uppercase tracking-tighter shadow-xl">
                  <Link href={`/admin/meetings/${nextMeeting.id}`}>
                    Ver Inscripciones
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <p className="text-[10px] text-center font-black uppercase opacity-60">Límite: {formatDate(nextMeeting.registrationDeadline)}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card className="p-12 text-center border-4 border-dashed rounded-[2.5rem] bg-muted/10">
          <CalendarDays className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-20" />
          <p className="text-muted-foreground font-black uppercase text-xl opacity-40">No hay reuniones programadas</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* REUNIONES FUTURAS (CALENDARIO) */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Calendario Programado</h2>
          </div>
          <div className="space-y-4">
            {otherFuture.length === 0 ? (
              <p className="text-sm italic text-muted-foreground font-medium bg-muted/5 p-4 rounded-xl border-2 border-dashed">No hay más reuniones en el calendario.</p>
            ) : (
              otherFuture.map((m) => (
                <Link key={m.id} href={`/admin/meetings/${m.id}`}>
                  <div className="group bg-white p-6 rounded-2xl border-2 hover:border-primary/40 transition-all flex items-center justify-between shadow-sm hover:shadow-md mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black uppercase tracking-tight text-lg">{m.title}</h4>
                        <p className="text-xs font-bold text-muted-foreground uppercase">{formatDate(m.date)}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* HISTORIAL (PASADAS) */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Historial de Reuniones</h2>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {past.length === 0 ? (
              <p className="text-sm italic text-muted-foreground font-medium">No hay reuniones pasadas.</p>
            ) : (
              past.map((m) => (
                <Link key={m.id} href={`/admin/meetings/${m.id}`}>
                  <div className="p-4 rounded-xl border bg-muted/5 hover:bg-white transition-all flex items-center justify-between opacity-70 hover:opacity-100 group">
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-black uppercase px-2 py-1 bg-muted rounded text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary">
                        PASADA
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase">{m.title}</p>
                        <p className="text-[10px] font-black text-muted-foreground">{formatDate(m.date)}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
