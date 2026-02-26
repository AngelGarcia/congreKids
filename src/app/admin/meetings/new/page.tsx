"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { getDefaultDeadline } from '@/lib/utils/date';
import { Plus, Trash2, Save } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !date) return;

    try {
      const meetingDate = new Date(date);
      const deadlineDate = deadline ? new Date(deadline) : getDefaultDeadline(meetingDate);

      await addDoc(collection(db, 'meetings'), {
        title,
        date: Timestamp.fromDate(meetingDate),
        registrationDeadline: Timestamp.fromDate(deadlineDate),
        status: 'upcoming',
        ageGroups,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      toast({ title: "Reunión creada", description: "La reunión ha sido publicada correctamente." });
      router.push('/admin');
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Hubo un problema al crear la reunión." });
    }
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
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Crear Nueva Reunión</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título de la reunión</Label>
              <Input 
                id="title" 
                placeholder="Ej. Encuentro de Padres Noviembre" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha de la reunión</Label>
                <Input 
                  id="date" 
                  type="datetime-local" 
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Límite inscripción (Opcional)</Label>
                <Input 
                  id="deadline" 
                  type="datetime-local" 
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  placeholder="Por defecto: Jueves anterior 23:59h"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Grupos de Edad</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addAgeGroup}>
              <Plus className="w-4 h-4 mr-2" />
              Añadir Grupo
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {ageGroups.map((group, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border p-4 rounded-lg relative">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Etiqueta del grupo</Label>
                  <Input 
                    placeholder="Ej. Bebés" 
                    value={group.label}
                    onChange={e => updateAgeGroup(index, 'label', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meses Mín.</Label>
                  <Input 
                    type="number" 
                    value={group.minMonths}
                    onChange={e => updateAgeGroup(index, 'minMonths', parseInt(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meses Máx.</Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="number" 
                      value={group.maxMonths}
                      onChange={e => updateAgeGroup(index, 'maxMonths', parseInt(e.target.value))}
                      required
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeAgeGroup(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit">
            <Save className="w-4 h-4 mr-2" />
            Publicar Reunión
          </Button>
        </div>
      </form>
    </div>
  );
}
