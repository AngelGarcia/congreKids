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
import { Plus, Trash2, Save, X, Calendar as CalendarIcon, Wand2, Check, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const handleGeneratePreview = () => {
    const fridays = generateFridaysForMonth(automationYear, automationMonth);
    setPreviewFridays(fridays);
    // Seleccionar todos por defecto al generar la lista
    setSelectedIndices(new Set(fridays.map((_, i) => i)));
  };

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const handleCreateBatch = () => {
    const fridaysToCreate = previewFridays.filter((_, i) => selectedIndices.has(i));

    if (!user || fridaysToCreate.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "Atención", 
        description: "Debes seleccionar al menos una fecha para crear el calendario." 
      });
      return;
    }

    fridaysToCreate.forEach(friday => {
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

    toast({ title: "Calendario generado", description: `Se han creado ${fridaysToCreate.length} reuniones para el mes.` });
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

  const updateAgeGroup = (index: number, field: string, value: any) => {
    const newGroups = [...ageGroups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setAgeGroups(newGroups);
  };

  const removeAgeGroup = (index: number) => {
    setAgeGroups(ageGroups.filter((_, i) => i !== index));
  };

  const addAgeGroup = () => {
    setAgeGroups([...ageGroups, { label: 'Nuevo Grupo', minMonths: 0, maxMonths: 144 }]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Programar Calendario</h1>
        <p className="text-muted-foreground font-medium text-lg">Crea reuniones individuales o automatiza el calendario de los viernes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
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
                    <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center justify-between px-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground">Selecciona los viernes a programar:</Label>
                        <span className="text-xs font-black text-primary uppercase">{selectedIndices.size} seleccionados</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {previewFridays.map((date, idx) => {
                          const isSelected = selectedIndices.has(idx);
                          return (
                            <div 
                              key={idx} 
                              className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${
                                isSelected ? 'bg-primary/5 border-primary/20' : 'bg-muted/10 border-transparent opacity-60'
                              }`}
                              onClick={() => toggleSelection(idx)}
                            >
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(idx)}
                                className="w-7 h-7 rounded-lg border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex flex-col">
                                <span className={`text-lg font-black uppercase tracking-tight leading-none ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                  {formatDate(date)}
                                </span>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                                  17:30H • Inscripciones abren el lunes anterior
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button 
                        onClick={handleCreateBatch} 
                        className="w-full h-16 rounded-2xl font-black text-xl shadow-2xl uppercase tracking-tighter mt-6"
                        disabled={selectedIndices.size === 0}
                      >
                        Confirmar y Crear {selectedIndices.size} {selectedIndices.size === 1 ? 'Reunión' : 'Reuniones'}
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

        {/* Panel de Configuración de Grupos de Edad */}
        <div className="space-y-6">
          <Card className="rounded-[2rem] border-2 border-primary/10 shadow-lg">
            <CardHeader className="bg-primary/5 p-6 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                Grupos de Edad
              </CardTitle>
              <CardDescription className="text-xs font-bold">
                Define las categorías y rangos para esta(s) reunión(es).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                {ageGroups.map((group, idx) => (
                  <div key={idx} className="p-4 bg-muted/10 rounded-2xl border-2 space-y-3 relative group">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeAgeGroup(idx)}
                      className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Etiqueta</Label>
                      <Input 
                        value={group.label} 
                        onChange={e => updateAgeGroup(idx, 'label', e.target.value)}
                        className="h-9 font-bold rounded-lg border-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Mín (meses)</Label>
                        <Input 
                          type="number" 
                          value={group.minMonths} 
                          onChange={e => updateAgeGroup(idx, 'minMonths', parseInt(e.target.value))}
                          className="h-9 font-bold rounded-lg border-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Máx (meses)</Label>
                        <Input 
                          type="number" 
                          value={group.maxMonths} 
                          onChange={e => updateAgeGroup(idx, 'maxMonths', parseInt(e.target.value))}
                          className="h-9 font-bold rounded-lg border-2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={addAgeGroup} variant="outline" className="w-full h-12 rounded-xl border-dashed border-2 font-black uppercase tracking-tighter">
                <Plus className="w-4 h-4 mr-2" /> Añadir Categoría
              </Button>
            </CardContent>
          </Card>
          
          <div className="bg-accent/10 p-6 rounded-2xl border-2 border-accent/20">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">Ayuda con los meses</h4>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-muted-foreground">
              <p>• 18 meses = 1.5 años</p>
              <p>• 36 meses = 3 años</p>
              <p>• 72 meses = 6 años</p>
              <p>• 144 meses = 12 años</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
