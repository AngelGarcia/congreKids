"use client";

import { useEffect, useState, use, useMemo } from 'react';
import { doc, collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { Download, FileDown, Lock, ChevronLeft, Unlock, Settings2, Baby, Music, Edit2, Save, X, Plus, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Users, ListFilter, ArrowUp, ArrowDown, UserCheck, MessageCircle, UserPlus, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

const EXPORT_COLUMNS = [
  { id: 'parentName', label: 'Padre/Madre' },
  { id: 'parentEmail', label: 'Email' },
  { id: 'childName', label: 'Nombre Hijo' },
  { id: 'ageGroup', label: 'Grupo Edad' },
  { id: 'birthDate', label: 'F. Nacimiento' },
  { id: 'familyName', label: 'Familia' },
  { id: 'guitar', label: 'Guitarra' },
];

type SortField = 'name' | 'familyName' | 'guitarSelected';
type SortOrder = 'asc' | 'desc';

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dbFirestore = useFirestore();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  
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
        // Ajuste para datetime-local input (YYYY-MM-DDTHH:MM)
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
  }, [meeting]);

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

  const handleToggleStatus = async () => {
    if (!meeting) return;
    const newStatus = meeting.status === 'closed' ? 'upcoming' : 'closed';
    updateDocumentNonBlocking(meetingRef, { status: newStatus });
    toast({ 
      title: newStatus === 'closed' ? "Plazo cerrado" : "Plazo abierto", 
      description: newStatus === 'closed' ? "Ya no se aceptan más inscripciones." : "Se han vuelto a habilitar las inscripciones." 
    });
  };

  const shareInvitation = () => {
    if (!meeting) return;
    const appUrl = window.location.origin;
    const text = `*CONVOCATORIA CONGREKIDS*\n\nYa está abierta la inscripción para la reunión: *${meeting.title}*\n\n📅 Fecha: ${formatDateTime(meeting.date)}\n⏳ Límite inscripción: ${formatDate(meeting.registrationDeadline)}\n\nPor favor, inscríbete aquí:\n🔗 ${appUrl}\n\n¡Te esperamos!`;
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
    setIsEditing(false);
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
    const dateInfo = `Fecha: ${formatDate(meeting.date)}\n`;
    const totalInfo = `Total: ${data.length} niños\n\n`;
    
    const childrenList = data.map(child => {
      const guitarEmoji = child.guitarSelected ? ' (GUITARRA)' : '';
      const cleanFamilyName = child.familyName?.startsWith('Familia ') 
        ? child.familyName.replace('Familia ', '') 
        : child.familyName;
      return `- ${child.name} (Fam. ${cleanFamilyName})${guitarEmoji}`;
    }).join('\n');

    const footer = `\n\nGenerado desde CongreKids`;
    
    const message = encodeURIComponent(header + meetingInfo + dateInfo + totalInfo + childrenList + footer);
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
    const activeCols = orderedColumns.filter(c => selectedColumns.includes(c.id));
    const headers = activeCols.map(c => c.label);
    const rows = [headers];

    dataToExport.forEach(child => {
      const rowData: string[] = activeCols.map(col => {
        switch (col.id) {
          case 'parentName': return child.parentName || '';
          case 'parentEmail': return child.parentEmail || '';
          case 'childName': return child.name || '';
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
    link.setAttribute("download", `inscripciones_${meeting?.title || 'reunion'}_${exportTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDialogOpen(false);
  };

  if (loadingMeeting || loadingRegistrations) return <div className="p-8 font-black uppercase text-primary">Cargando detalles...</div>;
  if (!meeting) return <div className="p-8">Reunión no encontrada.</div>;

  const totalChildrenCount = allChildren.length;
  const guitarCount = allChildren.filter(c => c.guitarSelected).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 w-full max-w-2xl">
          <Link href="/admin/meetings" className="text-sm text-muted-foreground flex items-center hover:text-primary mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
          
          {isEditing ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase">Título de la reunión</Label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-black text-xl h-12 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Fecha y Hora</Label>
                  <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Límite Inscripción</Label>
                  <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="font-bold" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-black tracking-tighter uppercase leading-tight">{meeting.title}</h1>
              <div className="text-muted-foreground flex items-center gap-3 font-medium">
                {formatDateTime(meeting.date)}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 shrink-0">
          {!isEditing && (
            <>
              <Button onClick={shareInvitation} className="rounded-xl font-black uppercase shadow-lg bg-green-600 hover:bg-green-700 h-12 px-6">
                <Share2 className="w-4 h-4 mr-2" /> Convocar por WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={handleToggleStatus} className="rounded-xl font-black uppercase h-12 px-4 w-full">
                {meeting.status === 'closed' ? <><Unlock className="w-4 h-4 mr-2" /> Abrir Plazo</> : <><Lock className="w-4 h-4 mr-2" /> Cerrar Plazo</>}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-8">
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
            {meeting.ageGroups?.map((group: any) => {
              const count = allChildren.filter(c => c.ageGroupLabel === group.label).length;
              const ratio = group.ratio || 8;
              const monitorsNeeded = Math.ceil(count / ratio);
              return (
                <Card key={group.label} className="border-muted bg-white rounded-2xl shadow-sm">
                  <CardHeader className="p-4 pb-1">
                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                      {group.label}
                      <span className="text-[10px] font-black opacity-30">Ratio 1:{ratio}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-black">{count}</div>
                      <span className="text-sm font-bold text-muted-foreground uppercase">niños</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-primary">
                      <UserCheck className="w-4 h-4" />
                      <span className="text-sm font-black uppercase tracking-tight">{monitorsNeeded} {monitorsNeeded === 1 ? 'monitor' : 'monitores'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-6">
            <Accordion type="multiple" defaultValue={["general"]} className="space-y-6">
              
              <AccordionItem value="general" className="rounded-2xl shadow-sm border overflow-hidden bg-white px-0">
                <div className="flex items-center justify-between bg-primary/5 pr-4">
                  <AccordionTrigger className="flex-1 hover:no-underline py-5 px-6 group border-none">
                    <div className="flex items-center gap-3">
                      <ListFilter className="w-5 h-5 text-primary" />
                      <h2 className="text-sm font-black uppercase tracking-widest text-primary">Listado General (Todos)</h2>
                      <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary font-black">{allChildren.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2 z-10 relative shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        shareOnWhatsApp(allChildren, "General");
                      }}
                      className="h-9 rounded-lg font-black uppercase text-[11px] bg-white shadow-sm border-green-500/20 text-green-600 hover:bg-green-50 shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-2" /> WhatsApp
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        openExportDialog(allChildren, "General");
                      }}
                      className="h-9 rounded-lg font-black uppercase text-[11px] bg-white shadow-sm border-primary/20 hover:bg-primary/5 shrink-0"
                    >
                      <FileDown className="w-3.5 h-3.5 mr-2" /> Exportar
                    </Button>
                  </div>
                </div>
                <AccordionContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-none h-12">
                        <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer group" onClick={() => toggleSort('name')}>
                          <div className="flex items-center">Nombre <SortIcon field="name" /></div>
                        </TableHead>
                        <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer group" onClick={() => toggleSort('familyName')}>
                          <div className="flex items-center">Familia <SortIcon field="familyName" /></div>
                        </TableHead>
                        <TableHead className="font-black uppercase text-xs tracking-widest text-base">Grupo</TableHead>
                        <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer group" onClick={() => toggleSort('guitarSelected')}>
                          <div className="flex items-center">Extra <SortIcon field="guitarSelected" /></div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allChildren.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 italic text-muted-foreground">Sin registros.</TableCell></TableRow>
                      ) : (
                        allChildren.map((child, idx) => (
                          <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-14">
                            <TableCell className="font-black text-lg">{child.name}</TableCell>
                            <TableCell className="text-base font-bold uppercase text-muted-foreground">Familia {child.familyName}</TableCell>
                            <TableCell><Badge variant="outline" className="text-base font-black uppercase px-3 py-1 border-primary/20 text-primary bg-primary/5">{child.ageGroupLabel}</Badge></TableCell>
                            <TableCell>
                              {child.guitarSelected && <Badge className="bg-accent text-white font-black text-base px-3 py-1"><Music className="w-4 h-4 mr-1" /> GUITARRA</Badge>}
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
                  <AccordionItem key={group.label} value={group.label} className="rounded-2xl shadow-sm border overflow-hidden bg-white px-0">
                    <div className="flex items-center justify-between bg-muted/5 pr-4">
                      <AccordionTrigger className="flex-1 hover:no-underline py-5 px-6 group border-none">
                        <div className="flex items-center gap-3">
                          <Baby className="w-5 h-5 text-muted-foreground" />
                          <h2 className="text-base font-black uppercase tracking-widest">Categoría: {group.label}</h2>
                          <Badge variant="outline" className="ml-2 font-black text-base">{childrenInGroup.length}</Badge>
                          <span className="text-sm font-bold text-muted-foreground uppercase ml-2 opacity-60">
                            ({group.minMonths / 12} - {group.maxMonths / 12} años)
                          </span>
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-2 z-10 relative shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            shareOnWhatsApp(childrenInGroup, group.label);
                          }}
                          className="h-9 rounded-lg font-black uppercase text-[11px] bg-white shadow-sm border-green-500/20 text-green-600 hover:bg-green-50 shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-2" /> WhatsApp
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            openExportDialog(childrenInGroup, group.label);
                          }}
                          className="h-9 rounded-lg font-black uppercase text-[11px] bg-white shadow-sm hover:bg-muted/5 shrink-0"
                        >
                          <FileDown className="w-3.5 h-3.5 mr-2" /> Exportar
                        </Button>
                      </div>
                    </div>
                    <AccordionContent className="p-0">
                      <div className="p-4 border-b bg-primary/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Users className="w-4 h-4" /> Monitores Asignados
                          </h4>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs font-black uppercase text-primary hover:bg-primary/10">
                                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Asignar
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2 rounded-xl shadow-xl">
                              <p className="text-[10px] font-black uppercase text-muted-foreground p-2 border-b mb-1">Monitores Disponibles</p>
                              {availableMonitors.length === 0 ? (
                                <p className="text-[10px] p-4 text-center italic text-muted-foreground">No hay monitores disponibles en la agenda.</p>
                              ) : (
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                  {availableMonitors.map(m => (
                                    <div 
                                      key={m.id} 
                                      className={cn(
                                        "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                                        group.assignedMonitors?.includes(m.id) ? "bg-primary/10" : "hover:bg-muted"
                                      )}
                                      onClick={() => handleAssignMonitor(groupIdx, m.id)}
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold">{m.firstName} {m.lastName}</span>
                                      </div>
                                      {group.assignedMonitors?.includes(m.id) && <UserCheck className="w-4 h-4 text-primary" />}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {assignedMonitors.length === 0 ? (
                            <p className="text-sm font-bold text-muted-foreground italic uppercase">Ningún monitor asignado todavía.</p>
                          ) : (
                            assignedMonitors.map(m => (
                              <Badge key={m.id} className="bg-white text-primary border-primary/20 font-bold text-sm px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                                <span className="truncate max-w-[150px] uppercase">{m.firstName}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleAssignMonitor(groupIdx, m.id)}
                                  className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <Table>
                        <TableHeader className="bg-muted/5">
                          <TableRow className="hover:bg-transparent border-none h-12">
                            <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer group" onClick={() => toggleSort('name')}>
                              <div className="flex items-center">Nombre <SortIcon field="name" /></div>
                            </TableHead>
                            <TableHead className="font-black uppercase text-xs tracking-widest cursor-pointer group" onClick={() => toggleSort('familyName')}>
                              <div className="flex items-center">Familia <SortIcon field="familyName" /></div>
                            </TableHead>
                            <TableHead className="font-black uppercase text-xs tracking-widest">Extra</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {childrenInGroup.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-8 italic text-muted-foreground">Sin niños en esta categoría.</TableCell></TableRow>
                          ) : (
                            childrenInGroup.map((child, idx) => (
                              <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-14">
                                <TableCell className="font-black text-lg">{child.name}</TableCell>
                                <TableCell className="text-base font-bold uppercase text-muted-foreground">Familia {child.familyName}</TableCell>
                                <TableCell>
                                  {child.guitarSelected && <Badge className="bg-accent text-white font-black text-base px-3 py-1"><Music className="w-4 h-4 mr-1" /> GUITARRA</Badge>}
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
        </div>

        <div className="space-y-6">
          <TooltipProvider>
            <Accordion type="single" collapsible defaultValue="settings" className="w-full">
              <AccordionItem value="settings" className={cn(
                "rounded-2xl border-2 shadow-lg transition-all overflow-hidden bg-white border-none sticky top-24",
                isEditing ? 'border-solid border-primary/20 shadow-primary/5' : 'border-dashed bg-muted/5'
              )}>
                <div className={cn(
                  "flex items-center justify-between px-6 py-2 border-b transition-colors",
                  isEditing ? "bg-primary/5 border-primary/10" : "bg-muted/5 border-muted"
                )}>
                  <AccordionTrigger className="flex-1 hover:no-underline py-5 group border-none mr-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Settings2 className={cn("w-5 h-5 shrink-0", isEditing ? 'text-primary' : 'text-muted-foreground')} />
                      <CardTitle className="text-base font-black uppercase tracking-widest truncate">Ajustes de Reunión</CardTitle>
                    </div>
                  </AccordionTrigger>
                  
                  <div className="flex items-center gap-2 z-10 relative shrink-0">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditAgeGroups([...editAgeGroups, { label: 'Nuevo', minMonths: 0, maxMonths: 144, allowsGuitar: false, ratio: 8, assignedMonitors: [] }]); 
                              }} 
                              className="h-8 w-8 rounded-lg text-primary"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-bold">Añadir Categoría</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} 
                              className="h-8 w-8 rounded-lg text-muted-foreground"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-bold">Cancelar</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="default" 
                              size="icon" 
                              onClick={(e) => { e.stopPropagation(); handleSaveChanges(); }} 
                              className="h-8 w-8 rounded-lg shadow-sm"
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-bold">Guardar Cambios</p></TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} 
                            className="h-9 w-9 rounded-lg bg-white shadow-sm"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-bold">Editar Configuración</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                
                <AccordionContent className="p-6 pt-6 space-y-4">
                  {(isEditing ? editAgeGroups : meeting.ageGroups)?.map((group: any, idx: number) => (
                    <div key={idx} className={cn(
                      "flex flex-col gap-2 pb-5 last:pb-0 last:border-0 border-b",
                      isEditing ? 'bg-primary/5 p-4 rounded-xl border-none shadow-sm' : ''
                    )}>
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <Input value={group.label} onChange={e => updateAgeGroup(idx, 'label', e.target.value)} className="h-10 font-black text-sm uppercase bg-white border-2" />
                            <Button variant="ghost" size="icon" onClick={() => setEditAgeGroups(editAgeGroups.filter((_, i) => i !== idx))} className="h-8 w-8 text-destructive ml-2 shrink-0"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-black uppercase text-muted-foreground">Mín (años)</Label>
                              <Input type="number" step="0.1" value={group.minMonths / 12} onChange={e => updateAgeGroup(idx, 'minMonths', parseFloat(e.target.value) * 12)} className="h-10 text-sm font-bold bg-white border-2" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-black uppercase text-muted-foreground">Máx (años)</Label>
                              <Input type="number" step="0.1" value={group.maxMonths / 12} onChange={e => updateAgeGroup(idx, 'maxMonths', parseFloat(e.target.value) * 12)} className="h-10 text-sm font-bold bg-white border-2" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-black uppercase text-muted-foreground">Ratio monitores : niños</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-primary">1 :</span>
                                <Input type="number" value={group.ratio || 8} onChange={e => updateAgeGroup(idx, 'ratio', parseInt(e.target.value))} className="h-10 text-base font-black bg-white border-2" />
                              </div>
                            </div>
                            <div className="flex flex-col justify-center items-end gap-1.5">
                              <Label className="text-xs font-black uppercase text-muted-foreground">Guitarra</Label>
                              <Switch checked={group.allowsGuitar} onCheckedChange={val => updateAgeGroup(idx, 'allowsGuitar', val)} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-black uppercase text-primary leading-none">{group.label}</span>
                            <div className="flex items-center gap-2">
                              {group.allowsGuitar && <Music className="w-4 h-4 text-accent" />}
                              <Badge variant="outline" className="text-xs font-black py-1 px-3 border-primary/20 bg-primary/5 text-primary">
                                Ratio 1:{group.ratio || 8}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-bold text-muted-foreground uppercase opacity-80">
                              De {group.minMonths / 12} a {group.maxMonths / 12} años
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {isEditing && (
                    <div className="pt-6 flex flex-col gap-3">
                      <Button 
                        onClick={handleSaveChanges}
                        className="w-full h-14 rounded-2xl font-black text-lg uppercase shadow-2xl tracking-tighter"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        Guardar Cambios
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => setIsEditing(false)}
                        className="w-full h-11 rounded-2xl font-black uppercase text-xs text-muted-foreground hover:bg-muted/10"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TooltipProvider>
        </div>
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
              <FileDown className="w-6 h-6" />
              Exportar {exportTitle}
            </DialogTitle>
            <DialogDescription className="font-bold">
              Selecciona y ordena las columnas para el listado de <strong>{exportTitle}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-2 py-6">
            <Label className="text-[11px] font-black uppercase text-muted-foreground mb-1">Orden y Selección de Columnas:</Label>
            {orderedColumns.map((col, idx) => (
              <div 
                key={col.id} 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 transition-all", 
                  selectedColumns.includes(col.id) ? 'border-primary/20 bg-primary/5' : 'border-transparent bg-muted/5 opacity-60'
                )}
              >
                <Checkbox 
                  id={`export-${col.id}`} 
                  checked={selectedColumns.includes(col.id)} 
                  onCheckedChange={() => setSelectedColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])}
                  className="w-5 h-5 rounded-md" 
                />
                <Label htmlFor={`export-${col.id}`} className="text-sm font-black uppercase cursor-pointer flex-1">
                  {col.label}
                </Label>
                <div className="flex gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-lg hover:bg-white" 
                    onClick={() => moveColumn(idx, 'up')}
                    disabled={idx === 0}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-lg hover:bg-white" 
                    onClick={() => moveColumn(idx, 'down')}
                    disabled={idx === orderedColumns.length - 1}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)} className="rounded-xl font-bold uppercase w-full">Cancelar</Button>
            <Button onClick={exportToCSV} className="rounded-xl font-black uppercase shadow-lg w-full" disabled={selectedColumns.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Descargar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
