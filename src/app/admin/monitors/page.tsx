
"use client";

import { useState } from 'react';
import { collection, query, orderBy, Timestamp, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  MoreVertical,
  UserPlus
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

export default function MonitorsAgenda() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // New monitor form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const monitorsQuery = useMemoFirebase(() => query(collection(db, 'monitors'), orderBy('firstName', 'asc')), [db]);
  const { data: monitors, isLoading } = useCollection(monitorsQuery);

  const filteredMonitors = monitors?.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm)
  ) || [];

  const handleAddMonitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone) return;

    addDocumentNonBlocking(collection(db, 'monitors'), {
      firstName,
      lastName,
      phone,
      isAvailable: true,
      createdAt: Timestamp.now(),
    });

    setFirstName('');
    setLastName('');
    setPhone('');
    setIsAddDialogOpen(false);
    toast({ title: "Monitor añadido", description: `${firstName} ya forma parte de la agenda.` });
  };

  const toggleAvailability = (monitor: any) => {
    updateDocumentNonBlocking(doc(db, 'monitors', monitor.id), {
      isAvailable: !monitor.isAvailable
    });
    toast({ 
      title: monitor.isAvailable ? "Monitor No Disponible" : "Monitor Disponible", 
      description: `${monitor.firstName} ha cambiado su estado.` 
    });
  };

  const handleDeleteMonitor = (monitor: any) => {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${monitor.firstName} de la agenda?`)) {
      deleteDocumentNonBlocking(doc(db, 'monitors', monitor.id));
      toast({ title: "Monitor eliminado", description: "El registro ha sido borrado con éxito." });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Agenda de Monitores</h1>
          <p className="text-muted-foreground font-medium text-lg">Listado de voluntarios y disponibilidad para las reuniones.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                    <Label className="text-xs font-black uppercase text-muted-foreground">Nombre</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-12 rounded-xl font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground">Apellidos</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} required className="h-12 rounded-xl font-bold border-2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Teléfono de Contacto</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} required type="tel" className="h-12 rounded-xl font-bold border-2" />
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
            <Card key={monitor.id} className={`rounded-[2rem] border-2 transition-all shadow-md overflow-hidden ${monitor.isAvailable ? 'border-primary/10 bg-white' : 'border-muted bg-muted/5 opacity-80'}`}>
              <CardHeader className="p-6 pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{monitor.firstName}</h3>
                    <p className="text-sm font-bold text-muted-foreground uppercase">{monitor.lastName}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteMonitor(monitor)} className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-6">
                <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="font-mono font-bold text-lg tracking-wider">{monitor.phone}</span>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {monitor.isAvailable ? (
                      <Badge className="bg-primary/10 text-primary border-none font-black uppercase text-[9px] px-2.5 py-0.5">
                        <UserCheck className="w-3 h-3 mr-1" /> Disponible
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-black uppercase text-[9px] px-2.5 py-0.5">
                        <UserMinus className="w-3 h-3 mr-1" /> No Disponible
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Estado</span>
                    <Switch 
                      checked={monitor.isAvailable} 
                      onCheckedChange={() => toggleAvailability(monitor)} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
