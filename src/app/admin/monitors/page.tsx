
"use client";

import { useState } from 'react';
import { collection, query, orderBy, Timestamp, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Contact, 
  Plus, 
  Search, 
  Phone, 
  Trash2, 
  UserCheck, 
  UserMinus, 
  UserPlus,
  Edit2,
  X,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

export default function MonitorsAgenda() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<any>(null);
  
  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');

  const monitorsQuery = useMemoFirebase(() => query(collection(db, 'monitors'), orderBy('firstName', 'asc')), [db]);
  const { data: monitors, isLoading } = useCollection(monitorsQuery);

  const filteredMonitors = monitors?.filter(m => 
    `${m.firstName} ${m.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.phone && m.phone.includes(searchTerm))
  ) || [];

  const handleAddMonitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName) return;

    addDocumentNonBlocking(collection(db, 'monitors'), {
      firstName,
      lastName: lastName || null,
      phone: phone || null,
      details: details || null,
      isAvailable: true,
      createdAt: Timestamp.now(),
    });

    resetForm();
    setIsAddDialogOpen(false);
    toast({ title: "Monitor añadido", description: `${firstName} ya forma parte de la agenda.` });
  };

  const handleEditMonitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonitor || !firstName) return;

    updateDocumentNonBlocking(doc(db, 'monitors', editingMonitor.id), {
      firstName,
      lastName: lastName || null,
      phone: phone || null,
      details: details || null,
    });

    resetForm();
    setIsEditDialogOpen(false);
    toast({ title: "Monitor actualizado", description: "Los datos han sido guardados." });
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setDetails('');
    setEditingMonitor(null);
  };

  const openEditDialog = (monitor: any) => {
    setEditingMonitor(monitor);
    setFirstName(monitor.firstName);
    setLastName(monitor.lastName || '');
    setPhone(monitor.phone || '');
    setDetails(monitor.details || '');
    setIsEditDialogOpen(true);
  };

  const toggleAvailability = (monitor: any) => {
    updateDocumentNonBlocking(doc(db, 'monitors', monitor.id), {
      isAvailable: !monitor.isAvailable
    });
    toast({ 
      title: monitor.isAvailable ? "No Disponible" : "Disponible", 
      description: `${monitor.firstName} ha cambiado su estado.` 
    });
  };

  const handleDeleteMonitor = (id: string) => {
    deleteDocumentNonBlocking(doc(db, 'monitors', id));
    toast({ title: "Monitor eliminado", description: "El registro ha sido borrado con éxito." });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Agenda de Monitores</h1>
          <p className="text-muted-foreground font-medium text-lg">Listado de voluntarios y disponibilidad para las reuniones.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-2xl font-black uppercase tracking-tighter shadow-xl h-14">
              <UserPlus className="w-5 h-5 mr-2" />
              Nuevo Monitor
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
            <form onSubmit={handleAddMonitor}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Añadir Monitor</DialogTitle>
                <DialogDescription className="font-bold">Introduce los datos del nuevo voluntario.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground">Nombre *</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-12 rounded-xl font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground">Apellidos</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-12 rounded-xl font-bold border-2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Teléfono de Contacto</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="h-12 rounded-xl font-bold border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Detalles / Notas</Label>
                  <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Preferencias, alergias o notas adicionales..." className="rounded-xl border-2 font-medium" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl font-bold uppercase">Cancelar</Button>
                <Button type="submit" className="rounded-xl font-black uppercase shadow-lg">Guardar Monitor</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <Search className="text-muted-foreground w-5 h-5 ml-2" />
        <Input 
          placeholder="Buscar monitor por nombre o teléfono..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0 text-lg font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3].map(i => <Card key={i} className="h-40 rounded-3xl animate-pulse bg-muted/20" />)
        ) : filteredMonitors.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-muted/10 rounded-[2.5rem] border-4 border-dashed">
            <Contact className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-black uppercase text-xl opacity-40">No hay monitores registrados</p>
          </div>
        ) : (
          filteredMonitors.map((monitor) => (
            <Card key={monitor.id} className={`rounded-[2rem] border-2 transition-all shadow-md overflow-hidden flex flex-col ${monitor.isAvailable ? 'border-primary/10 bg-white' : 'border-muted bg-muted/5 opacity-80'}`}>
              <CardHeader className="p-6 pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{monitor.firstName}</h3>
                    {monitor.lastName && <p className="text-sm font-bold text-muted-foreground uppercase">{monitor.lastName}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(monitor)} className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">¿Eliminar Monitor?</AlertDialogTitle>
                          <AlertDialogDescription className="font-bold">
                            Esta acción borrará a <strong>{monitor.firstName}</strong> de la agenda permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl font-bold uppercase">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteMonitor(monitor.id)} className="rounded-xl font-black uppercase bg-destructive text-white hover:bg-destructive/90">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4 flex-1 flex flex-col">
                {monitor.phone ? (
                  <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="font-mono font-bold text-lg tracking-wider">{monitor.phone}</span>
                  </div>
                ) : (
                  <div className="h-[52px] flex items-center justify-center border-2 border-dashed rounded-xl border-muted/30 shrink-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/40">Sin teléfono</p>
                  </div>
                )}

                {monitor.details && (
                  <div className="flex gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 flex-1 min-h-[60px]">
                    <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium leading-relaxed italic text-muted-foreground">
                      {monitor.details}
                    </p>
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-4 pt-4 border-t w-full mt-auto">
                  <span className={cn(
                    "text-[10px] font-black uppercase transition-colors",
                    !monitor.isAvailable ? "text-destructive" : "text-muted-foreground/40"
                  )}>
                    No Disponible
                  </span>
                  <Switch 
                    checked={monitor.isAvailable} 
                    onCheckedChange={() => toggleAvailability(monitor)} 
                  />
                  <span className={cn(
                    "text-[10px] font-black uppercase transition-colors",
                    monitor.isAvailable ? "text-primary" : "text-muted-foreground/40"
                  )}>
                    Disponible
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Monitor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
          <form onSubmit={handleEditMonitor}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Editar Monitor</DialogTitle>
              <DialogDescription className="font-bold">Actualiza la información del voluntario.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Nombre *</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-12 rounded-xl font-bold border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Apellidos</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-12 rounded-xl font-bold border-2" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground">Teléfono de Contacto</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="h-12 rounded-xl font-bold border-2" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground">Detalles / Notas</Label>
                <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Preferencias, alergias o notas adicionales..." className="rounded-xl border-2 font-medium" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl font-bold uppercase">Cancelar</Button>
              <Button type="submit" className="rounded-xl font-black uppercase shadow-lg">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
