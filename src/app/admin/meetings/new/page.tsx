
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, Timestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { getDefaultDeadline } from '@/lib/utils/date';
import { Plus, Trash2, Save, X, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [ageGroups, setAgeGroups] = useState(DEFAULT_AGE_GROUPS);

  const handleSubmit = (e: React.FormEvent) => {
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
    router.push('/admin');
  };

  const addAgeGroup = () => {
    setAgeGroups([...ageGroups, { label: '', minMonths: 0, maxMonths: 12 }]);
  };

  const removeAgeGroup = (index: number) => {
    setAgeGroups(ageGroups.filter((_, i) => i !== index));
  };

  const updateAgeGroup = (index: number, field: string, value: string | number) => {
    const newGroups = [...ageGroups];
    (newGroups[index] as any)[field] = value;
    setAgeGroups(newGroups);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Nueva Reunión</h1>
        <p className="text-muted-foreground font-medium">Configura los detalles del encuentro y los grupos de guardería.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="rounded-3xl shadow-xl border-none">
          <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary" />
              Detalles Generales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="title" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Título de la reunión</Label>
              <Input 
                id="title" 
                placeholder="Ej. Encuentro de Padres Noviembre" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="h-14 text-lg rounded-xl border-2 font-bold"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="date" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Fecha y hora del evento</Label>
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
                <Label htmlFor="deadline" className="text-xs font-black uppercase text-muted-foreground tracking-widest">Cierre de inscripción</Label>
                <Input 
                  id="deadline" 
                  type="datetime-local" 
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="h-14 text-lg rounded-xl border-2 font-bold"
                  placeholder="Opcional"
                />
                <p className="text-[10px] text-muted-foreground font-bold uppercase italic">Por defecto: Jueves anterior 23:59h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-xl border-none">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-8 border-b">
            <CardTitle className="text-xl font-black uppercase">Grupos de Edad</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addAgeGroup} className="rounded-xl border-2 font-bold bg-white">
              <Plus className="w-4 h-4 mr-2" />
              Añadir Grupo
            </Button>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {ageGroups.map((group, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-muted/20 p-6 rounded-2xl relative border-2 border-transparent hover:border-primary/10 transition-colors">
                <div className="space-y-2 col-span-1 md:col-span-6">
                  <Label className="text-[10px] font-black uppercase">Etiqueta</Label>
                  <Input 
                    placeholder="Ej. Bebés" 
                    value={group.label}
                    onChange={e => updateAgeGroup(index, 'label', e.target.value)}
                    required
                    className="font-bold rounded-xl"
                  />
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="text-[10px] font-black uppercase">Meses Mín.</Label>
                  <Input 
                    type="number" 
                    value={group.minMonths}
                    onChange={e => updateAgeGroup(index, 'minMonths', parseInt(e.target.value))}
                    required
                    className="font-bold rounded-xl"
                  />
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="text-[10px] font-black uppercase">Meses Máx.</Label>
                  <Input 
                    type="number" 
                    value={group.maxMonths}
                    onChange={e => updateAgeGroup(index, 'maxMonths', parseInt(e.target.value))}
                    required
                    className="font-bold rounded-xl"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 flex justify-end">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeAgeGroup(index)}
                    className="text-destructive hover:bg-destructive/10 rounded-xl h-10 w-10"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="h-14 px-8 font-black uppercase rounded-xl">Cancelar</Button>
          <Button type="submit" className="h-14 px-12 rounded-xl text-lg font-black shadow-xl uppercase tracking-tighter">
            <Save className="w-5 h-5 mr-2" />
            Publicar Reunión
          </Button>
        </div>
      </form>
    </div>
  );
}
