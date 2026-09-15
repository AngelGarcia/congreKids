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
import { formatDate, formatDateTime, isRegistrationOpen, getRegistrationOpeningDate, calculateAgeInMonths } from '@/lib/utils/date';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

/**
 * Badge dinámico de género.
 */
function RenderGenderBadge({ gender }: { gender: string }) {
  const isGirl = gender === 'niña';
  
  return (
    <div className={cn(
      "flex items-center justify-center w-8 h-8 rounded-full shadow-sm border-2",
      isGirl ? "bg-pink-100 text-pink-500 border-pink-200" : "bg-blue-100 text-blue-500 border-blue-200"
    )}>
      <Baby className="w-4 h-4" />
    </div>
  );
}

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const dbFirestore = useFirestore();
  const { toast } = useToast();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const meetingRef = useMemoFirebase(() => doc(dbFirestore, 'meetings', id), [dbFirestore, id]);
  const { data: meeting, isLoading: loadingMeeting } = useDoc(meetingRef);

  const registrationsQuery = useMemoFirebase(() => collection(dbFirestore, 'meetings', id, 'registrations'), [dbFirestore, id]);
  const { data: registrations, isLoading: loadingRegistrations } = useCollection(registrationsQuery);

  const monitorsQuery = useMemoFirebase(() => query(collection(dbFirestore, 'monitors'), orderBy('firstName', 'asc')), [dbFirestore]);
  const { data: allMonitors } = useCollection(monitorsQuery);

  const availableMonitors = useMemo(() => {
    return allMonitors?.filter(m => m.isAvailable) || [];
  }, [allMonitors]);

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [orderedColumns, setOrderedColumns] = useState([...EXPORT_COLUMNS]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORT_COLUMNS.map(c => c.id));
  const [dataToExport, setDataToExport] = useState<any[]>([]);
  const [exportTitle, setExportTitle] = useState('');

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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
    if (meeting.status === 'open') return true;
    if (meeting.status === 'closed') return false;
    
    const openingDate = getRegistrationOpeningDate((meeting.date as any).toDate());
    const deadline = (meeting.registrationDeadline as any).toDate();
    return isRegistrationOpen(deadline, openingDate);
  }, [meeting]);

  const handleToggleStatus = async () => {
    if (!meeting) return;
    const shouldOpen = !isCurrentlyOpen;
    const newStatus = shouldOpen ? 'open' : 'closed';
    updateDocumentNonBlocking(meetingRef, { status: newStatus });
    toast({ title: shouldOpen ? "Plazo abierto" : "Plazo cerrado" });
  };

  const handleDeleteMeeting = async () => {
    if (!meetingRef) return;
    setIsSettingsOpen(false);
    deleteDocumentNonBlocking(meetingRef);
    toast({ title: "Reunión eliminada" });
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
    toast({ title: "Configuración actualizada" });
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

  return (
    <div className="space-y-6 sm:space-y-10 max-w-7xl mx-auto px-4 sm:px-0 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Link href="/admin/meetings" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center hover:text-primary transition-all active:scale-95">
            <ChevronLeft className="w-4 h-4 mr-1" /> Listado de Reuniones
          </Link>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-primary break-words">{meeting.title}</h1>
          <div className="text-muted-foreground flex items-center gap-3 font-bold uppercase text-[10px] sm:text-xs tracking-widest mt-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{formatDateTime(meeting.date)}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 shrink-0">
          <Button onClick={shareInvitation} className="rounded-2xl font-black uppercase shadow-xl bg-green-600 hover:bg-green-700 h-14 px-4 sm:px-6 order-2 sm:order-1 col-span-1">
            <Share2 className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">WhatsApp</span><span className="sm:hidden">Invit.</span>
          </Button>
          
          <Button variant="outline" onClick={handleToggleStatus} className="rounded-2xl font-black uppercase h-14 px-4 sm:px-6 order-3 sm:order-2 col-span-1 border-2">
            {isCurrentlyOpen ? (
              <><Lock className="w-4 h-4 mr-2" /> Cerrar</>
            ) : (
              <><Unlock className="w-4 h-4 mr-2" /> Abrir</>
            )}
          </Button>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="rounded-2xl font-black uppercase h-14 px-4 sm:px-6 order-1 sm:order-3 col-span-2 sm:col-auto bg-muted/50 border-2">
                <Settings2 className="w-5 h-5 mr-2" /> Configurar Encuentro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-[95vw] rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
              <DialogHeader className="p-6 sm:p-10 bg-primary/5 border-b">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center gap-3">
                  <Settings2 className="w-6 h-6" /> Configuración
                </DialogTitle>
                <DialogDescription className="font-bold">Ajustes generales y categorías de edad.</DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[60vh] sm:max-h-[70vh] p-6 sm:p-10">
                <div className="space-y-10">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Título</Label>
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-black text-xl h-14 rounded-2xl border-2 bg-muted/10 focus:bg-white" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Fecha y Hora</Label>
                        <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-14 font-bold rounded-2xl border-2 bg-muted/10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Límite Inscripción</Label>
                        <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="h-14 font-bold rounded-2xl border-2 bg-muted/10" />
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-primary/10" />

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Categorías de Edad</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditAgeGroups([...editAgeGroups, { label: 'Nuevo', minMonths: 0, maxMonths: 144, allowsGuitar: false, ratio: 8, assignedMonitors: [] }])}
                        className="h-9 px-4 rounded-xl text-[10px] font-black uppercase bg-primary/5 text-primary border-none active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {editAgeGroups.map((group, idx) => (
                        <Card key={idx} className="bg-muted/10 border-2 rounded-[2rem] p-5 space-y-5 relative shadow-sm">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditAgeGroups(editAgeGroups.filter((_, i) => i !== idx))} 
                            className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2 space-y-1">
                                <Label className="text-[9px] font-black uppercase">Nombre</Label>
                                <Input value={group.label} onChange={e => updateAgeGroup(idx, 'label', e.target.value)} className="h-10 font-bold text-sm rounded-xl border-none shadow-inner" />
                              </div>
                              <div className="space-y-1 text-center">
                                <Label className="text-[9px] font-black uppercase">Ratio</Label>
                                <Input type="number" value={group.ratio || 8} onChange={e => updateAgeGroup(idx, 'ratio', parseInt(e.target.value))} className="h-10 font-bold text-sm text-center rounded-xl border-none shadow-inner" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase">Mín (años)</Label>
                                <Input 
                                  type="number" 
                                  step="0.1" 
                                  value={Math.round((group.minMonths / 12) * 10) / 10} 
                                  onChange={e => updateAgeGroup(idx, 'minMonths', parseFloat(e.target.value) * 12)} 
                                  className="h-10 font-bold text-sm rounded-xl border-none shadow-inner" 
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase">Máx (años)</Label>
                                <Input 
                                  type="number" 
                                  step="0.1" 
                                  value={Math.round((group.maxMonths / 12) * 10) / 10} 
                                  onChange={e => updateAgeGroup(idx, 'maxMonths', parseFloat(e.target.value) * 12)} 
                                  className="h-10 font-bold text-sm rounded-xl border-none shadow-inner" 
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t-2 border-white/40">
                               <div className="flex items-center gap-2">
                                 <Music className="w-4 h-4 text-accent" />
                                 <span className="text-[10px] font-black uppercase">Guitarra</span>
                               </div>
                               <Switch checked={group.allowsGuitar} onCheckedChange={val => updateAgeGroup(idx, 'allowsGuitar', val)} />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-destructive/10" />

                  <div className="p-8 bg-destructive/5 rounded-[2.5rem] border-4 border-dashed border-destructive/10 space-y-5">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                      <h4 className="text-sm font-black uppercase text-destructive tracking-[0.2em]">Zona de Peligro</h4>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed">
                      Borrar esta reunión eliminará permanentemente todos los datos de inscripción.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full rounded-2xl font-black uppercase tracking-tighter shadow-lg h-14 active:scale-95 transition-all">
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar Permanentemente
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[3rem] border-none shadow-2xl p-8">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">¿Confirmas el borrado?</AlertDialogTitle>
                          <AlertDialogDescription className="font-bold text-lg leading-tight">
                            Esta acción eliminará la reunión <strong>"{meeting.title}"</strong> para siempre.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-3">
                          <AlertDialogCancel className="rounded-2xl font-bold uppercase h-14 px-8 border-2">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteMeeting} className="rounded-2xl font-black uppercase bg-destructive text-destructive-foreground hover:bg-destructive/90 h-14 px-8">
                            Sí, eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="p-6 sm:p-10 bg-muted/30 border-t flex-col sm:flex-row gap-3">
                <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-2xl h-14 px-8 font-bold uppercase order-2 sm:order-1">Cancelar</Button>
                <Button onClick={handleSaveChanges} className="rounded-2xl font-black uppercase shadow-2xl h-14 px-10 bg-primary text-white order-1 sm:order-2 active:scale-95 transition-all">
                  <Save className="w-4 h-4 mr-2" /> Guardar Todo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-none bg-accent/10 rounded-[2rem] shadow-sm flex flex-col items-center justify-center p-6 text-center">
          <Music className="w-6 h-6 text-accent mb-2" />
          <div className="text-3xl font-black text-accent">{guitarCount}</div>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">Guitarra</p>
        </Card>
        <Card className="border-none bg-primary/10 rounded-[2rem] shadow-sm flex flex-col items-center justify-center p-6 text-center">
          <Baby className="w-6 h-6 text-primary mb-2" />
          <div className="text-3xl font-black text-primary">{totalChildrenCount}</div>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">Total Niños</p>
        </Card>
        {meeting.ageGroups?.slice(0, 2).map((group: any) => {
          const count = allChildren.filter(c => c.ageGroupLabel === group.label).length;
          return (
            <Card key={group.label} className="border-none bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center p-6 text-center hidden sm:flex">
              <Users className="w-6 h-6 text-muted-foreground mb-2 opacity-40" />
              <div className="text-3xl font-black">{count}</div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">{group.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="space-y-6">
        <Accordion type="multiple" defaultValue={["general"]} className="space-y-6">
          <AccordionItem value="general" className="rounded-[2.5rem] shadow-xl border-none overflow-hidden bg-white px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-primary/5 p-4 sm:p-6 sm:pr-8 gap-4">
              <AccordionTrigger className="hover:no-underline py-0 group border-none justify-start gap-4">
                <ListFilter className="w-6 h-6 text-primary" />
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-primary">Inscripción General</h2>
                <Badge className="bg-primary text-white font-black text-base px-3 h-8 rounded-xl shadow-md">{allChildren.length}</Badge>
              </AccordionTrigger>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); shareOnWhatsApp(allChildren, "General"); }}
                  className="h-12 rounded-2xl font-black uppercase text-[10px] bg-white border-green-500/20 text-green-600 hover:bg-green-50 shadow-sm flex-1"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">WhatsApp</span><span className="sm:hidden">WhatsApp</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); openExportDialog(allChildren, "General"); }}
                  className="h-12 rounded-2xl font-black uppercase text-[10px] bg-white border-primary/20 hover:bg-primary/5 shadow-sm flex-1"
                >
                  <FileDown className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Exportar</span><span className="sm:hidden">CSV</span>
                </Button>
              </div>
            </div>
            <AccordionContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10 border-b-2 border-primary/5">
                    <TableRow className="hover:bg-transparent border-none h-16">
                      <TableHead className="font-black uppercase text-[10px] tracking-widest cursor-pointer px-8" onClick={() => toggleSort('name')}>
                        <div className="flex items-center">Nombre <SortIcon field="name" /></div>
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-center px-4">Sexo</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest cursor-pointer px-4" onClick={() => toggleSort('familyName')}>
                        <div className="flex items-center">Familia <SortIcon field="familyName" /></div>
                      </TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest px-4">Extra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allChildren.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20 italic text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-30">Sin registros</TableCell></TableRow>
                    ) : (
                      allChildren.map((child, idx) => (
                        <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-20">
                          <TableCell className="font-black text-xl px-8 leading-none">{child.name}</TableCell>
                          <TableCell className="px-4"><div className="flex justify-center"><RenderGenderBadge gender={child.gender} /></div></TableCell>
                          <TableCell className="text-sm font-black uppercase text-muted-foreground px-4 leading-tight">{child.familyName}</TableCell>
                          <TableCell className="px-4">
                            {child.guitarSelected && <Badge className="bg-accent text-white font-black text-[9px] px-3 py-1 shadow-sm"><Music className="w-3 h-3 mr-1" /> GUITARRA</Badge>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {meeting.ageGroups?.map((group: any, groupIdx: number) => {
            const childrenInGroup = allChildren.filter(c => (c.ageGroupLabel || 'Sin grupo') === group.label);
            const assignedMonitors = allMonitors?.filter(m => group.assignedMonitors?.includes(m.id)) || [];
            
            return (
              <AccordionItem key={group.label} value={group.label} className="rounded-[2.5rem] shadow-xl border-none overflow-hidden bg-white px-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/10 p-4 sm:p-6 sm:pr-8 gap-4">
                  <AccordionTrigger className="hover:no-underline py-0 group border-none justify-start gap-4">
                    <Baby className="w-6 h-6 text-muted-foreground" />
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black uppercase tracking-tighter">{group.label}</h2>
                        <Badge variant="secondary" className="font-black text-sm px-2.5 h-7 rounded-lg">{childrenInGroup.length}</Badge>
                      </div>
                      <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60 tracking-[0.2em]">
                        {Math.round((group.minMonths / 12) * 10) / 10}-{Math.round((group.maxMonths / 12) * 10) / 10} años
                      </span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); shareOnWhatsApp(childrenInGroup, group.label); }} className="h-12 rounded-2xl font-black uppercase text-[10px] bg-white border-green-500/20 text-green-600 hover:bg-green-50 shadow-sm flex-1">
                      <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openExportDialog(childrenInGroup, group.label); }} className="h-12 rounded-2xl font-black uppercase text-[10px] bg-white border-primary/20 hover:bg-primary/5 shadow-sm flex-1">
                      <FileDown className="w-4 h-4 mr-2" /> CSV
                    </Button>
                  </div>
                </div>
                <AccordionContent className="p-0">
                  <div className="p-6 sm:p-8 border-b-2 border-primary/5 bg-primary/5 space-y-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2.5">
                        <Users className="w-4 h-4" /> Monitores Asignados
                      </h4>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 rounded-xl text-[10px] font-black uppercase text-primary hover:bg-primary/10 bg-white shadow-sm border-none active:scale-95">
                            <UserPlus className="w-4 h-4 mr-2" /> Asignar
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2 rounded-[2rem] shadow-2xl border-none">
                          <p className="text-[10px] font-black uppercase text-muted-foreground p-4 border-b-2 border-muted mb-2 tracking-widest">Disponibles</p>
                          <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 custom-scrollbar">
                            {availableMonitors.length === 0 ? (
                              <p className="text-[10px] p-6 text-center italic text-muted-foreground font-bold uppercase tracking-widest opacity-40">No hay monitores</p>
                            ) : (
                              availableMonitors.map(m => (
                                <div 
                                  key={m.id} 
                                  className={cn(
                                    "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all active:scale-95",
                                    group.assignedMonitors?.includes(m.id) ? "bg-primary text-white shadow-lg" : "hover:bg-primary/5 bg-muted/10 font-bold"
                                  )}
                                  onClick={() => handleAssignMonitor(groupIdx, m.id)}
                                >
                                  <span className="text-xs font-black uppercase tracking-tight">{m.firstName}</span>
                                  {group.assignedMonitors?.includes(m.id) && <UserCheck className="w-4 h-4 text-white" />}
                                </div>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {assignedMonitors.length === 0 ? (
                        <p className="text-[10px] font-black text-muted-foreground italic uppercase tracking-widest opacity-40 py-2">Ningún monitor asignado.</p>
                      ) : (
                        assignedMonitors.map(m => (
                          <Badge key={m.id} className="bg-white text-primary border-2 border-primary/10 font-black text-[10px] px-4 py-2 flex items-center gap-2.5 shadow-md rounded-2xl">
                            <span className="uppercase tracking-tight">{m.firstName}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleAssignMonitor(groupIdx, m.id)} className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive rounded-full active:scale-75">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10 border-b-2 border-primary/5">
                        <TableRow className="hover:bg-transparent border-none h-16">
                          <TableHead className="font-black uppercase text-[10px] tracking-widest px-8">Niño</TableHead>
                          <TableHead className="font-black uppercase text-[10px] tracking-widest text-center px-4">Sexo</TableHead>
                          <TableHead className="font-black uppercase text-[10px] tracking-widest px-4">Familia</TableHead>
                          <TableHead className="font-black uppercase text-[10px] tracking-widest px-8">Extra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {childrenInGroup.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-20 italic text-muted-foreground font-bold uppercase tracking-widest opacity-30">Vacío</TableCell></TableRow>
                        ) : (
                          childrenInGroup.map((child, idx) => (
                            <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-20">
                              <TableCell className="font-black text-xl px-8 leading-none">{child.name}</TableCell>
                              <TableCell className="px-4 flex justify-center py-6"><RenderGenderBadge gender={child.gender} /></TableCell>
                              <TableCell className="text-sm font-black uppercase text-muted-foreground px-4 leading-tight">{child.familyName}</TableCell>
                              <TableCell className="px-8">
                                {child.guitarSelected && <Badge className="bg-accent text-white font-black text-[9px] px-3 py-1 shadow-sm"><Music className="w-3.5 h-3.5 mr-1.5" /> GUITARRA</Badge>}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl w-[95vw] max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-8 sm:p-10 bg-primary/5 border-b">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center gap-3">
              <FileDown className="w-7 h-7" /> Exportar Datos
            </DialogTitle>
            <DialogDescription className="font-bold text-sm">Listado {exportTitle.toUpperCase()}. Selecciona y ordena las columnas.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto p-6 sm:p-8 space-y-2.5 custom-scrollbar">
            {orderedColumns.map((col, idx) => (
              <div key={col.id} className={cn("flex items-center gap-4 p-4 rounded-2xl border-2 transition-all", selectedColumns.includes(col.id) ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-transparent bg-muted/10 opacity-60')}>
                <Checkbox checked={selectedColumns.includes(col.id)} onCheckedChange={() => setSelectedColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])} className="w-7 h-7 rounded-xl border-2" />
                <Label className="text-xs font-black uppercase flex-1 tracking-tight">{col.label}</Label>
                <div className="flex gap-1 bg-white p-1 rounded-xl shadow-inner border border-primary/5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => moveColumn(idx, 'up')} disabled={idx === 0}><ArrowUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => moveColumn(idx, 'down')} disabled={idx === orderedColumns.length - 1}><ArrowUp className="w-4 h-4 rotate-180" /></Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="p-8 sm:p-10 bg-muted/30 border-t flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)} className="rounded-2xl h-14 font-bold uppercase order-2 sm:order-1">Cancelar</Button>
            <Button onClick={exportToCSV} className="rounded-2xl font-black uppercase shadow-2xl px-8 h-14 bg-primary text-white order-1 sm:order-2 active:scale-95 transition-all" disabled={selectedColumns.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Descargar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
