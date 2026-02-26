"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, Timestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { getDefaultDeadline, generateFridaysForMonth, formatDate } from '@/lib/utils/date';
import { Plus, Trash2, Save, X, Calendar as CalendarIcon, Wand2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_AGE_GROUPS = [
  { label: 'Bebés', minMonths: 0, maxMonths: 18 },
  { label: 'Pequeños', minMonths: 18, maxMonths: 36 },
  { label: '3-6 años', minMonths: 36, maxMonths: 72 },
  { label: 'Mayores', minMonths: 72, maxMonths: 144 },
];

export default function NewMeeting() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Single creation state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [ageGroups, setAgeGroups] = useState(DEFAULT_AGE_GROUPS);

  // Automation state
  const [automationYear, setAutomationYear] = useState(new Date().getFullYear());
  const [automationMonth, setAutomationMonth] = useState(new Date().getMonth());
  const [previewFridays, setPreviewFridays] = useState<Date[]>([]);

  const handleGeneratePreview = () => {
    const fridays = generateFridaysForMonth(automationYear, automationMonth);
    setPreviewFridays(fridays);
  };

  const handleCreateBatch = () => {
    if (!user || previewFridays.length === 0) return;

    previewFridays.forEach(friday => {
      const deadlineDate = getDefaultDeadline(friday);
      addDocumentNonBlocking(collection(db, 'meetings'), {
        title: formatDate(friday), // Título automático: Viernes, X de Mes
        date: Timestamp.fromDate(friday),
        registrationDeadline: Timestamp.fromDate(deadlineDate),
        status: 'upcoming',
        ageGroups,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
    });

    toast({ title: "Calendario generado", description: `Se han creado ${previewFridays.length} reuniones para el mes.` });
    router.push('/admin/meetings');
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !date) return;

    const meetingDate = new Date(date);
    const deadlineDate = deadline ? new Date(deadline) : getDefaultDeadline(meetingDate);

    addDocumentNonBlocking(collection(db, 'meetings'), {
      title,
      date: Timestamp.fromDate(meetingDate),
      registrationDeadline: Timestamp.fromDate(deadlineDate),
      status: 'upcoming',
      ageGroups,
      createdBy: user.uid,
      createdAt: Timestamp.now(),
    });

    toast({ title: "Reunión creada", description: "Se ha publicado correctamente." });
    router.push('/admin/meetings');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Programar Calendario</h1>
        <p className="text-muted-foreground font-medium text-lg">Crea reuniones individuales o automatiza el calendario de los viernes.</p>
      </div>

      <Tabs defaultValue="automated" className="space-y-8">
        <TabsList className="bg-muted/20 p-1 h-14 rounded-2xl border-2">
          <TabsTrigger value="automated" className="rounded-xl h-full font-black uppercase tracking-tighter data-[state=active]:bg-primary data-[state=active]:text-white">
            <Wand2 className="w-4 h-4 mr-2" />
            Generador Automático
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-xl h-full font-black uppercase tracking-tighter data-[state=active]:bg-primary data-[state=active]:text-white">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automated">
          <Card className="rounded-[2.5rem] shadow-xl border-none overflow-hidden">
            <CardHeader className="bg-primary/5 p-8 border-b">
              <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                <Wand2 className="w-6 h-6 text-primary" />
                Configuración del Mes
              </CardTitle>
              <CardDescription className="font-bold">
                Crea automáticamente todos los viernes a las 17:30h con inscripciones que abren los lunes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Año</Label>
                  <Input 
                    type="number" 
                    value={automationYear} 
                    onChange={e => setAutomationYear(parseInt(e.target.value))}
                    className="h-14 rounded-xl border-2 font-black text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Mes</Label>
                  <select 
                    value={automationMonth}
                    onChange={e => setAutomationMonth(parseInt(e.target.value))}
                    className="w-full h-14 rounded-xl border-2 bg-white px-4 font-black text-lg appearance-none"
                  >
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button onClick={handleGeneratePreview} variant="outline" className="w-full h-14 rounded-xl border-2 border-primary text-primary font-black uppercase tracking-tighter hover:bg-primary/5">
                Previsualizar Viernes del Mes
              </Button>

              {previewFridays.length > 0 && (
                <div className="space-y-4 pt-4">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Reuniones a crear:</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {previewFridays.map((date, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="font-bold">{formatDate(date)} - 17:30h</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleCreateBatch} className="w-full h-16 rounded-2xl font-black text-xl shadow-2xl uppercase tracking-tighter">
                    Confirmar y Crear {previewFridays.length} Reuniones
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <form onSubmit={handleSingleSubmit} className="space-y-8">
            <Card className="rounded-[2.5rem] shadow-xl border-none">
              <CardHeader className="bg-primary/5 p-8 border-b">
                <CardTitle className="text-xl font-black uppercase">Detalles de la Reunión</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest">Título</Label>
                  <Input 
                    id="title" 
                    placeholder="Ej. Encuentro Extraordinario" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    className="h-14 text-lg rounded-xl border-2 font-bold"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="date" className="text-xs font-black uppercase tracking-widest">Fecha y hora</Label>
                    <Input 
                      id="date" 
                      type="datetime-local" 
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                      className="h-14 text-lg rounded-xl border-2 font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="deadline" className="text-xs font-black uppercase tracking-widest">Límite inscripción</Label>
                    <Input 
                      id="deadline" 
                      type="datetime-local" 
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="h-14 text-lg rounded-xl border-2 font-bold"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl font-black text-xl shadow-2xl uppercase tracking-tighter mt-6">
                  Publicar Reunión Individual
                </Button>
              </CardContent>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}