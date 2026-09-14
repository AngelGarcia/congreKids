
"use client";

import { useEffect, useState, use, useMemo } from 'react';
import { doc, collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { formatDate, formatDateTime, isRegistrationOpen, getRegistrationOpeningDate } from '@/lib/utils/date';
import { Download, FileDown, Lock, ChevronLeft, Unlock, Settings2, Baby, Music, Save, X, Plus, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Users, ListFilter, ArrowUp, ArrowDown, UserCheck, MessageCircle, UserPlus, Share2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';

const EXPORT_COLUMNS = [
  { id: 'parentName', label: 'Padre/Madre' },
  { id: 'parentEmail', label: 'Email' },
  { id: 'childName', label: 'Nombre Hijo' },
  { id: 'gender', label: 'Género' },
  { id: 'ageGroup', label: 'Grupo Edad' },
  { id: 'birthDate', label: 'F. Nacimiento' },
  { id: 'familyName', label: 'Familia' },
  { id: 'guitar', label: 'Guitarra' },
];

type SortField = 'name' | 'familyName' | 'guitarSelected' | 'gender';
type SortOrder = 'asc' | 'desc';

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const dbFirestore = useFirestore();
  const { toast } = useToast();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Hooks para datos de la reunión
  const meetingRef = useMemoFirebase(() => doc(dbFirestore, 'meetings', id), [dbFirestore, id]);
  const { data: meeting, isLoading: loadingMeeting } = useDoc(meetingRef);

  // Hooks para inscripciones
  const registrationsQuery = useMemoFirebase(() => collection(dbFirestore, 'meetings', id, 'registrations'), [dbFirestore, id]);
  const { data: registrations, isLoading: loadingRegistrations } = useCollection(registrationsQuery);

  // Monitors from agenda
  const monitorsQuery = useMemoFirebase(() => query(collection(dbFirestore, 'monitors'), orderBy('firstName', 'asc')), [dbFirestore]);
  const { data: allMonitors } = useCollection(monitorsQuery);

  const availableMonitors = useMemo(() => {
    return allMonitors?.filter(m => m.isAvailable) || [];
  }, [allMonitors]);

  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [orderedColumns, setOrderedColumns] = useState([...EXPORT_COLUMNS]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORT_COLUMNS.map(c => c.id));
  const [dataToExport, setDataToExport] = useState<any[]>([]);
  const [exportTitle, setExportTitle] = useState('');

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // State for editing
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editAgeGroups, setEditAgeGroups] = useState<any[]>([]);

  useEffect(() => {
    if (meeting) {
      setEditTitle(meeting.title);
      try {
        const dateObj = (meeting.date as any).toDate();
        const deadlineObj = (meeting.registrationDeadline as any).toDate();
        const formatForInput = (d: Date) => {
          const pad = (n: number) => n.toString().padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setEditDate(formatForInput(dateObj));
        setEditDeadline(formatForInput(deadlineObj));
      } catch (e) {
        console.error("Error formatting dates for edit", e);
      }
      setEditAgeGroups(meeting.ageGroups || []);
    }
  }, [meeting, isSettingsOpen]);

  const allChildren = useMemo(() => {
    const children: any[] = [];
    (registrations || []).forEach(reg => {
      (reg.children || []).forEach((child: any) => {
        children.push({
          ...child,
          familyName: reg.familyName,
          parentName: reg.parentName,
          parentEmail: reg.parentEmail,
          registrationId: reg.id
        });
      });
    });

    return children.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (typeof valA === 'boolean') {
        valA = valA ? 1 : 0;
        valB = valB ? 1 : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [registrations, sortField, sortOrder]);

  const isCurrentlyOpen = useMemo(() => {
    if (!meeting) return false;
    // La reunión se considera abierta si su estado es explícitamente 'open'
    // O si es 'upcoming' y estamos dentro de las fechas automáticas
    if (meeting.status === 'open') return true;
    if (meeting.status === 'closed') return false;
    
    const openingDate = getRegistrationOpeningDate((meeting.date as any).toDate());
    const deadline = (meeting.registrationDeadline as any).toDate();
    return isRegistrationOpen(deadline, openingDate);
  }, [meeting]);

  const handleToggleStatus = async () => {
    if (!meeting) return;
    const shouldOpen = !isCurrentlyOpen;
    // Si queremos abrir manualmente, usamos el estado 'open' que ignora plazos
    const newStatus = shouldOpen ? 'open' : 'closed';
    updateDocumentNonBlocking(meetingRef, { status: newStatus });
    
    const now = new Date();
    const deadline = (meeting.registrationDeadline as any).toDate();
    const hasPassedDeadline = now > deadline;

    if (shouldOpen && hasPassedDeadline) {
      toast({ 
        title: "Plazo abierto con aviso", 
        description: "Se ha activado el estado, pero la fecha límite ya ha pasado. Por favor, edita la 'Fecha Límite'.",
        variant: "destructive"
      });
    } else {
      toast({ title: shouldOpen ? "Plazo abierto" : "Plazo cerrado" });
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meetingRef) return;
    setIsSettingsOpen(false);
    deleteDocumentNonBlocking(meetingRef);
    toast({ title: "Reunión eliminada", description: "El encuentro ha sido borrado correctamente." });
    router.push('/admin/meetings');
  };

  const shareInvitation = () => {
    if (!meeting) return;
    const appUrl = window.location.origin;
    const text = `*CONVOCATORIA CONGREKIDS*\n\nYa está abierta la inscripción para la reunión: *${meeting.title}*\n\n📅 Fecha: ${formatDateTime(meeting.date)}\n⏳ Límite inscripción: ${formatDate(meeting.registrationDeadline)}\n\nPor favor, inscríbete aquí:\n🔗 ${appUrl}`;
    const message = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleSaveChanges = async () => {
    const updatedData = {
      title: editTitle,
      date: Timestamp.fromDate(new Date(editDate)),
      registrationDeadline: Timestamp.fromDate(new Date(editDeadline)),
      ageGroups: editAgeGroups,
    };

    updateDocumentNonBlocking(meetingRef, updatedData);
    setIsSettingsOpen(false);
    toast({ title: "Cambios guardados", description: "La configuración de la reunión ha sido actualizada." });
  };

  const handleAssignMonitor = (groupIdx: number, monitorId: string) => {
    if (!meeting) return;
    const newAgeGroups = [...meeting.ageGroups];
    const group = { ...newAgeGroups[groupIdx] };
    const assigned = [...(group.assignedMonitors || [])];
    
    if (assigned.includes(monitorId)) {
      group.assignedMonitors = assigned.filter((id: string) => id !== monitorId);
    } else {
      group.assignedMonitors = [...assigned, monitorId];
    }
    
    newAgeGroups[groupIdx] = group;
    updateDocumentNonBlocking(meetingRef, { ageGroups: newAgeGroups });
    toast({ title: "Monitores actualizados" });
  };

  const shareOnWhatsApp = (data: any[], title: string) => {
    if (!meeting) return;
    const header = `LISTADO ${title.toUpperCase()}\n`;
    const meetingInfo = `Reunión: ${meeting.title}\n`;
    const totalInfo = `Total: ${data.length} niños\n\n`;
    
    const childrenList = data.map(child => {
      const guitarEmoji = child.guitarSelected ? ' (GUITARRA)' : '';
      const cleanFamilyName = child.familyName?.startsWith('Familia ') 
        ? child.familyName.replace('Familia ', '') 
        : child.familyName;
      const genderSymbol = child.gender === 'niña' ? '👧' : '👦';
      return `${genderSymbol} - ${child.name} (Fam. ${cleanFamilyName})${guitarEmoji}`;
    }).join('\n');

    const message = encodeURIComponent(header + meetingInfo + totalInfo + childrenList);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const updateAgeGroup = (index: number, field: string, value: any) => {
    const newGroups = [...editAgeGroups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setEditAgeGroups(newGroups);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 w-3.5 h-3.5 opacity-30" />;
    return sortOrder === 'asc' ? <ChevronUp className="ml-1 w-3.5 h-3.5 text-primary" /> : <ChevronDown className="ml-1 w-3.5 h-3.5 text-primary" />;
  };

  const openExportDialog = (data: any[], title: string) => {
    setDataToExport(data);
    setExportTitle(title);
    setIsExportDialogOpen(true);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newOrdered = [...orderedColumns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrdered.length) return;
    [newOrdered[index], newOrdered[targetIndex]] = [newOrdered[targetIndex], newOrdered[index]];
    setOrderedColumns(newOrdered);
  };

  const exportToCSV = () => {
    const activeCols = orderedColumns.filter(col => selectedColumns.includes(col.id));
    const headers = activeCols.map(c => c.label);
    const rows = [headers];

    dataToExport.forEach(child => {
      const rowData: string[] = activeCols.map(col => {
        switch (col.id) {
          case 'parentName': return child.parentName || '';
          case 'parentEmail': return child.parentEmail || '';
          case 'childName': return child.name || '';
          case 'gender': return child.gender || 'niño';
          case 'ageGroup': return child.ageGroupLabel || '';
          case 'birthDate': return formatDate(child.birthDate);
          case 'familyName': return child.familyName || '';
          case 'guitar': return child.guitarSelected ? 'SÍ' : 'NO';
          default: return '';
        }
      });
      rows.push(rowData);
    });

    const BOM = '\uFEFF';
    const csvContent = rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inscripciones_${meeting?.title || 'reunion'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDialogOpen(false);
  };

  if (loadingMeeting || loadingRegistrations) return <div className="p-8 font-black uppercase text-primary">Cargando...</div>;
  if (!meeting) return <div className="p-8">Reunión no encontrada.</div>;

  const totalChildrenCount = allChildren.length;
  const guitarCount = allChildren.filter(c => c.guitarSelected).length;

  const RenderGenderBadge = ({ gender }: { gender: string }) => {
    const isGirl = gender === 'niña';
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit",
        isGirl ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"
      )}>
        <Baby className="w-3 h-3" />
        {gender}
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <Link href="/admin/meetings" className="text-sm text-muted-foreground flex items-center hover:text-primary mb-2 font-bold uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver al listado
          </Link>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-tight text-primary">{meeting.title}</h1>
          <div className="text-muted-foreground flex items-center gap-3 font-bold uppercase text-xs tracking-widest">
            {formatDateTime(meeting.date)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button onClick={shareInvitation} className="rounded-xl font-black uppercase shadow-lg bg-green-600 hover:bg-green-700 h-12 px-6">
            <Share2 className="w-4 h-4 mr-2" /> WhatsApp
          </Button>
          
          <Button variant="outline" onClick={handleToggleStatus} className="rounded-xl font-black uppercase h-12 px-6">
            {isCurrentlyOpen ? (
              <><Lock className="w-4 h-4 mr-2" /> Cerrar Plazo</>
            ) : (
              <><Unlock className="w-4 h-4 mr-2" /> Abrir Plazo</>
            )}
          </Button>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="rounded-xl font-black uppercase h-12 px-4">
                <Settings2 className="w-5 h-5 mr-2" /> Ajustes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
              <DialogHeader className="p-8 bg-primary/5 border-b">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                  <Settings2 className="w-6 h-6" /> Configurar Reunión
                </DialogTitle>
                <DialogDescription className="font-bold">
                  Modifica los datos generales y categorías de edad de este encuentro.
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[70vh] p-8">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Título de la reunión</Label>
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-black text-lg h-12 rounded-xl border-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fecha y Hora</Label>
                        <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-12 font-bold rounded-xl border-2" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Límite Inscripción</Label>
                        <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="h-12 font-bold rounded-xl border-2" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Categorías de Edad</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditAgeGroups([...editAgeGroups, { label: 'Nuevo', minMonths: 0, maxMonths: 144, allowsGuitar: false, ratio: 8, assignedMonitors: [] }])}
                        className="h-8 text-[10px] font-black uppercase"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Añadir
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {editAgeGroups.map((group, idx) => (
                        <Card key={idx} className="bg-muted/5 border-2 rounded-2xl p-4 space-y-4 relative group">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditAgeGroups(editAgeGroups.filter((_, i) => i !== idx))} 
                            className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-1">
                              <Label className="text-[8px] font-black uppercase">Nombre Categoría</Label>
                              <Input value={group.label} onChange={e => updateAgeGroup(idx, 'label', e.target.value)} className="h-9 font-bold text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[8px] font-black uppercase">Ratio 1:N</Label>
                              <Input type="number" value={group.ratio || 8} onChange={e => updateAgeGroup(idx, 'ratio', parseInt(e.target.value))} className="h-9 font-bold text-sm" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[8px] font-black uppercase">Edad Mín (años)</Label>
                              <Input 
                                type="number" 
                                step="0.1" 
                                value={Math.round((group.minMonths / 12) * 10) / 10} 
                                onChange={e => updateAgeGroup(idx, 'minMonths', parseFloat(e.target.value) * 12)} 
                                className="h-9 font-bold text-sm" 
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[8px] font-black uppercase">Edad Máx (años)</Label>
                              <Input 
                                type="number" 
                                step="0.1" 
                                value={Math.round((group.maxMonths / 12) * 10) / 10} 
                                onChange={e => updateAgeGroup(idx, 'maxMonths', parseFloat(e.target.value) * 12)} 
                                className="h-9 font-bold text-sm" 
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t">
                             <div className="flex items-center gap-2">
                               <Music className="w-4 h-4 text-accent" />
                               <span className="text-[10px] font-black uppercase">Permitir Guitarra</span>
                             </div>
                             <Switch checked={group.allowsGuitar} onCheckedChange={val => updateAgeGroup(idx, 'allowsGuitar', val)} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="p-6 bg-destructive/5 rounded-2xl border-2 border-dashed border-destructive/20 space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <h4 className="text-xs font-black uppercase text-destructive tracking-widest">Zona de Peligro</h4>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                      Borrar esta reunión eliminará permanentemente todos los datos de inscripción y monitores asignados. Esta acción no se puede deshacer.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full rounded-xl font-black uppercase tracking-tighter shadow-sm h-12">
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar Reunión
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">¿Estás completamente seguro?</AlertDialogTitle>
                          <AlertDialogDescription className="font-bold">
                            Esta acción eliminará la reunión <strong>"{meeting.title}"</strong> y todas las inscripciones asociadas para siempre.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl font-bold uppercase">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteMeeting} className="rounded-xl font-black uppercase bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sí, eliminar permanentemente
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="p-8 bg-muted/5 border-t">
                <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl font-bold uppercase">Cancelar</Button>
                <Button onClick={handleSaveChanges} className="rounded-xl font-black uppercase shadow-xl h-12 px-8">
                  <Save className="w-4 h-4 mr-2" /> Guardar Todo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-accent/40 bg-accent/5 rounded-2xl shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <Music className="w-3 h-3" /> Clase Guitarra
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-accent">{guitarCount}</div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Niños apuntados</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 rounded-2xl shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <Baby className="w-3 h-3" /> Total Inscritos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-primary">{totalChildrenCount}</div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Niños confirmados</p>
          </CardContent>
        </Card>
        {meeting.ageGroups?.slice(0, 2).map((group: any) => {
          const count = allChildren.filter(c => c.ageGroupLabel === group.label).length;
          return (
            <Card key={group.label} className="border-muted bg-white rounded-2xl shadow-sm">
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                  {group.label}
                  <span className="text-[10px] font-black opacity-30">1:{group.ratio || 8}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-3xl font-black">{count}</div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Inscritos</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-6">
        <Accordion type="multiple" defaultValue={["general"]} className="space-y-6">
          <AccordionItem value="general" className="rounded-3xl shadow-sm border overflow-hidden bg-white px-0">
            <div className="flex items-center justify-between bg-primary/5 pr-4">
              <AccordionTrigger className="flex-1 hover:no-underline py-6 px-8 group border-none">
                <div className="flex items-center gap-4">
                  <ListFilter className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-black uppercase tracking-tighter text-primary">Listado General</h2>
                  <Badge variant="secondary" className="bg-primary/10 text-primary font-black text-sm px-3">{allChildren.length}</Badge>
                </div>
              </AccordionTrigger>
              <div className="flex items-center gap-2 z-10 relative shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); shareOnWhatsApp(allChildren, "General"); }}
                  className="h-10 rounded-xl font-black uppercase text-[11px] bg-white border-green-500/20 text-green-600 hover:bg-green-50"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); openExportDialog(allChildren, "General"); }}
                  className="h-10 rounded-xl font-black uppercase text-[11px] bg-white border-primary/20 hover:bg-primary/5"
                >
                  <FileDown className="w-4 h-4 mr-2" /> Exportar
                </Button>
              </div>
            </div>
            <AccordionContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/5">
                  <TableRow className="hover:bg-transparent border-none h-14">
                    <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer" onClick={() => toggleSort('name')}>
                      <div className="flex items-center">Nombre <SortIcon field="name" /></div>
                    </TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer" onClick={() => toggleSort('gender')}>
                      <div className="flex items-center">Género <SortIcon field="gender" /></div>
                    </TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer" onClick={() => toggleSort('familyName')}>
                      <div className="flex items-center">Familia <SortIcon field="familyName" /></div>
                    </TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest">Categoría</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer" onClick={() => toggleSort('guitarSelected')}>
                      <div className="flex items-center">Guitarra <SortIcon field="guitarSelected" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allChildren.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 italic text-muted-foreground font-bold">Sin registros hasta el momento.</TableCell></TableRow>
                  ) : (
                    allChildren.map((child, idx) => (
                      <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-16">
                        <TableCell className="font-black text-xl">{child.name}</TableCell>
                        <TableCell>
                          <RenderGenderBadge gender={child.gender} />
                        </TableCell>
                        <TableCell className="text-base font-bold uppercase text-muted-foreground">Familia {child.familyName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-black uppercase px-3 py-1 border-primary/20 text-primary bg-primary/5">{child.ageGroupLabel}</Badge></TableCell>
                        <TableCell>
                          {child.guitarSelected && <Badge className="bg-accent text-white font-black text-xs px-3 py-1"><Music className="w-3 h-3 mr-1" /> GUITARRA</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>

          {meeting.ageGroups?.map((group: any, groupIdx: number) => {
            const childrenInGroup = allChildren.filter(c => (c.ageGroupLabel || 'Sin grupo') === group.label);
            const assignedMonitors = allMonitors?.filter(m => group.assignedMonitors?.includes(m.id)) || [];
            
            return (
              <AccordionItem key={group.label} value={group.label} className="rounded-3xl shadow-sm border overflow-hidden bg-white px-0">
                <div className="flex items-center justify-between bg-muted/5 pr-4">
                  <AccordionTrigger className="flex-1 hover:no-underline py-6 px-8 group border-none">
                    <div className="flex items-center gap-4">
                      <Baby className="w-6 h-6 text-muted-foreground" />
                      <h2 className="text-xl font-black uppercase tracking-tighter">Categoría: {group.label}</h2>
                      <Badge variant="outline" className="font-black text-sm px-3">{childrenInGroup.length}</Badge>
                      <span className="text-xs font-bold text-muted-foreground uppercase opacity-60">
                        ({Math.round((group.minMonths / 12) * 10) / 10}-{Math.round((group.maxMonths / 12) * 10) / 10} años)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2 z-10 relative shrink-0">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); shareOnWhatsApp(childrenInGroup, group.label); }} className="h-10 rounded-xl font-black uppercase text-[11px] bg-white border-green-500/20 text-green-600 hover:bg-green-50">
                      <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openExportDialog(childrenInGroup, group.label); }} className="h-10 rounded-xl font-black uppercase text-[11px] bg-white border-primary/20 hover:bg-primary/5">
                      <FileDown className="w-4 h-4 mr-2" /> Exportar
                    </Button>
                  </div>
                </div>
                <AccordionContent className="p-0">
                  <div className="p-6 border-b bg-primary/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Users className="w-4 h-4" /> Monitores Asignados
                      </h4>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary hover:bg-primary/10">
                            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Asignar Monitor
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 rounded-2xl shadow-2xl border-none">
                          <p className="text-[10px] font-black uppercase text-muted-foreground p-3 border-b mb-1">Disponibles en Agenda</p>
                          <div className="max-h-60 overflow-y-auto space-y-1 p-1">
                            {availableMonitors.length === 0 ? (
                              <p className="text-[10px] p-4 text-center italic text-muted-foreground">No hay monitores disponibles.</p>
                            ) : (
                              availableMonitors.map(m => (
                                <div 
                                  key={m.id} 
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors",
                                    group.assignedMonitors?.includes(m.id) ? "bg-primary/10" : "hover:bg-muted"
                                  )}
                                  onClick={() => handleAssignMonitor(groupIdx, m.id)}
                                >
                                  <span className="text-sm font-bold uppercase">{m.firstName}</span>
                                  {group.assignedMonitors?.includes(m.id) && <UserCheck className="w-4 h-4 text-primary" />}
                                </div>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {assignedMonitors.length === 0 ? (
                        <p className="text-xs font-bold text-muted-foreground italic uppercase">Ningún monitor asignado.</p>
                      ) : (
                        assignedMonitors.map(m => (
                          <Badge key={m.id} className="bg-white text-primary border-primary/20 font-bold text-xs px-3 py-1.5 flex items-center gap-2 shadow-sm">
                            <span className="uppercase">{m.firstName}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleAssignMonitor(groupIdx, m.id)} className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive">
                              <X className="w-3 h-3" />
                            </Button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-none h-14">
                        <TableHead className="font-black uppercase text-xs tracking-widest">Nombre</TableHead>
                        <TableHead className="font-black uppercase text-xs tracking-widest">Género</TableHead>
                        <TableHead className="font-black uppercase text-xs tracking-widest">Familia</TableHead>
                        <TableHead className="font-black uppercase text-xs tracking-widest">Extra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {childrenInGroup.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-12 italic text-muted-foreground font-bold">Sin niños en esta categoría.</TableCell></TableRow>
                      ) : (
                        childrenInGroup.map((child, idx) => (
                          <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-16">
                            <TableCell className="font-black text-xl">{child.name}</TableCell>
                            <TableCell>
                              <RenderGenderBadge gender={child.gender} />
                            </TableCell>
                            <TableCell className="text-base font-bold uppercase text-muted-foreground">Familia {child.familyName}</TableCell>
                            <TableCell>
                              {child.guitarSelected && <Badge className="bg-accent text-white font-black text-xs px-3 py-1"><Music className="w-3 h-3 mr-1" /> GUITARRA</Badge>}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-md">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
              <FileDown className="w-6 h-6" /> Exportar {exportTitle}
            </DialogTitle>
            <DialogDescription className="font-bold">Personaliza tu listado antes de descargarlo.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 p-6 pt-2">
            {orderedColumns.map((col, idx) => (
              <div key={col.id} className={cn("flex items-center gap-3 p-3 rounded-2xl border-2 transition-all", selectedColumns.includes(col.id) ? 'border-primary/20 bg-primary/5' : 'border-transparent bg-muted/5 opacity-60')}>
                <Checkbox checked={selectedColumns.includes(col.id)} onCheckedChange={() => setSelectedColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])} className="w-6 h-6 rounded-lg" />
                <Label className="text-xs font-black uppercase flex-1">{col.label}</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveColumn(idx, 'up')} disabled={idx === 0}><ArrowUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveColumn(idx, 'down')} disabled={idx === orderedColumns.length - 1}><ArrowUp className="w-4 h-4 rotate-180" /></Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="p-6 bg-muted/5 border-t">
            <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)} className="rounded-xl font-bold uppercase">Cancelar</Button>
            <Button onClick={exportToCSV} className="rounded-xl font-black uppercase shadow-lg px-8 h-12" disabled={selectedColumns.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Descargar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
