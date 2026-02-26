"use client";

import { useEffect, useState, use, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, updateDoc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { Download, FileDown, Lock, ChevronLeft, Unlock, Settings2, Baby, Music, Edit2, Save, X, Plus, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Users, ListFilter } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
  const [meeting, setMeeting] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNextMeeting, setIsNextMeeting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(EXPORT_COLUMNS.map(c => c.id));
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const { toast } = useToast();

  // State for editing
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editAgeGroups, setEditAgeGroups] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const mDoc = await getDoc(doc(db, 'meetings', id));
        if (mDoc.exists()) {
          const data = { id: mDoc.id, ...mDoc.data() };
          setMeeting(data);
          
          setEditTitle(data.title);
          setEditDate(new Date((data.date as any).toDate().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
          setEditDeadline(new Date((data.registrationDeadline as any).toDate().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
          setEditAgeGroups(data.ageGroups || []);

          const now = new Date();
          const q = query(
            collection(db, 'meetings'),
            where('date', '>=', Timestamp.fromDate(now)),
            orderBy('date', 'asc'),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty && snap.docs[0].id === id) {
            setIsNextMeeting(true);
          }
        }

        const rSnap = await getDocs(collection(db, 'meetings', id, 'registrations'));
        setRegistrations(rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'meetings/' + id,
          operation: 'get'
        }));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const allChildren = useMemo(() => {
    const children: any[] = [];
    registrations.forEach(reg => {
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
    const newStatus = meeting.status === 'closed' ? 'upcoming' : 'closed';
    updateDoc(doc(db, 'meetings', id), { status: newStatus })
      .then(() => {
        setMeeting({ ...meeting, status: newStatus });
        toast({ 
          title: newStatus === 'closed' ? "Plazo cerrado" : "Plazo abierto", 
          description: newStatus === 'closed' ? "Ya no se aceptan más inscripciones." : "Se han vuelto a habilitar las inscripciones." 
        });
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'meetings/' + id,
          operation: 'update',
          requestResourceData: { status: newStatus }
        }));
      });
  };

  const handleSaveChanges = async () => {
    const updatedData = {
      title: editTitle,
      date: Timestamp.fromDate(new Date(editDate)),
      registrationDeadline: Timestamp.fromDate(new Date(editDeadline)),
      ageGroups: editAgeGroups,
    };

    updateDoc(doc(db, 'meetings', id), updatedData)
      .then(() => {
        setMeeting({ ...meeting, ...updatedData });
        setIsEditing(false);
        toast({ title: "Cambios guardados", description: "La configuración de la reunión ha sido actualizada." });
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'meetings/' + id,
          operation: 'update',
          requestResourceData: updatedData
        }));
      });
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
    if (sortField !== field) return <ArrowUpDown className="ml-1 w-3 h-3 opacity-30" />;
    return sortOrder === 'asc' ? <ChevronUp className="ml-1 w-3 h-3 text-primary" /> : <ChevronDown className="ml-1 w-3 h-3 text-primary" />;
  };

  const exportToCSV = () => {
    const headers = EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.id)).map(c => c.label);
    const rows = [headers];

    allChildren.forEach(child => {
      const rowData: string[] = [];
      if (selectedColumns.includes('parentName')) rowData.push(child.parentName || '');
      if (selectedColumns.includes('parentEmail')) rowData.push(child.parentEmail || '');
      if (selectedColumns.includes('childName')) rowData.push(child.name || '');
      if (selectedColumns.includes('ageGroup')) rowData.push(child.ageGroupLabel || '');
      if (selectedColumns.includes('birthDate')) rowData.push(formatDate(child.birthDate));
      if (selectedColumns.includes('familyName')) rowData.push(child.familyName || '');
      if (selectedColumns.includes('guitar')) rowData.push(child.guitarSelected ? 'SÍ' : 'NO');
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

  if (loading) return <div className="p-8">Cargando detalles de la reunión...</div>;
  if (!meeting) return <div className="p-8">Reunión no encontrada.</div>;

  const totalChildrenCount = allChildren.length;
  const guitarCount = allChildren.filter(c => c.guitarSelected).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
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
              <h1 className="text-3xl font-bold tracking-tight uppercase tracking-tighter">{meeting.title}</h1>
              <div className="text-muted-foreground flex items-center gap-3 font-medium">
                {formatDateTime(meeting.date)}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl font-bold uppercase">
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={handleSaveChanges} className="rounded-xl font-bold uppercase shadow-lg">
                <Save className="w-4 h-4 mr-2" /> Guardar Cambios
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="rounded-xl font-bold uppercase">
                <Edit2 className="w-4 h-4 mr-2" /> Editar Configuración
              </Button>
              {!isNextMeeting && (
                <Button variant="outline" size="sm" onClick={handleToggleStatus} className="rounded-xl font-bold uppercase">
                  {meeting.status === 'closed' ? <><Unlock className="w-4 h-4 mr-2" /> Abrir Plazo</> : <><Lock className="w-4 h-4 mr-2" /> Cerrar Plazo</>}
                </Button>
              )}
              <Button size="sm" onClick={() => setIsExportDialogOpen(true)} className="rounded-xl font-bold uppercase shadow-md">
                <FileDown className="w-4 h-4 mr-2" /> Exportar CSV
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-8">
          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-accent/40 bg-accent/5 rounded-2xl shadow-sm">
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Music className="w-3 h-3" /> Clase Guitarra
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-3xl font-black text-accent">{guitarCount}</div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase">Niños apuntados</p>
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
                <p className="text-[9px] text-muted-foreground font-bold uppercase">Niños confirmados</p>
              </CardContent>
            </Card>
            {/* Tarjetas por categoría (dinámicas) */}
            {meeting.ageGroups?.map((group: any) => {
              const count = allChildren.filter(c => c.ageGroupLabel === group.label).length;
              return (
                <Card key={group.label} className="border-muted bg-white rounded-2xl shadow-sm">
                  <CardHeader className="p-4 pb-1">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-black">{count}</div>
                    <p className="text-[8px] font-bold uppercase opacity-50">Niños</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-6">
            <Accordion type="multiple" defaultValue={["general"]} className="space-y-6">
              
              {/* LISTADO GENERAL */}
              <AccordionItem value="general" className="rounded-2xl shadow-sm border overflow-hidden bg-white px-0">
                <AccordionTrigger className="hover:no-underline py-4 px-6 bg-primary/5 group">
                  <div className="flex items-center gap-3">
                    <ListFilter className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-primary">Listado General (Todos)</h2>
                    <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary font-black">{allChildren.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/5">
                      <TableRow className="hover:bg-transparent border-none h-10">
                        <TableHead className="font-black uppercase text-[9px] tracking-widest cursor-pointer group" onClick={() => toggleSort('name')}>
                          <div className="flex items-center">Nombre <SortIcon field="name" /></div>
                        </TableHead>
                        <TableHead className="font-black uppercase text-[9px] tracking-widest cursor-pointer group" onClick={() => toggleSort('familyName')}>
                          <div className="flex items-center">Familia <SortIcon field="familyName" /></div>
                        </TableHead>
                        <TableHead className="font-black uppercase text-[9px] tracking-widest">Grupo</TableHead>
                        <TableHead className="font-black uppercase text-[9px] tracking-widest cursor-pointer group" onClick={() => toggleSort('guitarSelected')}>
                          <div className="flex items-center">Extra <SortIcon field="guitarSelected" /></div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allChildren.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-6 italic text-muted-foreground">Sin registros.</TableCell></TableRow>
                      ) : (
                        allChildren.map((child, idx) => (
                          <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-12">
                            <TableCell className="font-black text-sm">{child.name}</TableCell>
                            <TableCell className="text-[11px] font-bold uppercase text-muted-foreground">Familia {child.familyName}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[8px] font-black">{child.ageGroupLabel}</Badge></TableCell>
                            <TableCell>
                              {child.guitarSelected && <Badge className="bg-accent text-white font-black text-[8px]"><Music className="w-2 h-2 mr-1" /> GUITARRA</Badge>}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              {/* LISTADOS POR CATEGORÍA */}
              {meeting.ageGroups?.map((group: any) => {
                const childrenInGroup = allChildren.filter(c => (c.ageGroupLabel || 'Sin grupo') === group.label);
                return (
                  <AccordionItem key={group.label} value={group.label} className="rounded-2xl shadow-sm border overflow-hidden bg-white px-0">
                    <AccordionTrigger className="hover:no-underline py-4 px-6 bg-muted/5">
                      <div className="flex items-center gap-3">
                        <Baby className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-sm font-black uppercase tracking-widest">Categoría: {group.label}</h2>
                        <Badge variant="outline" className="ml-2 font-black">{childrenInGroup.length}</Badge>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase ml-2 opacity-60">
                          ({group.minMonths / 12} - {group.maxMonths / 12} años)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/5">
                          <TableRow className="hover:bg-transparent border-none h-10">
                            <TableHead className="font-black uppercase text-[9px] tracking-widest cursor-pointer group" onClick={() => toggleSort('name')}>
                              <div className="flex items-center">Nombre <SortIcon field="name" /></div>
                            </TableHead>
                            <TableHead className="font-black uppercase text-[9px] tracking-widest cursor-pointer group" onClick={() => toggleSort('familyName')}>
                              <div className="flex items-center">Familia <SortIcon field="familyName" /></div>
                            </TableHead>
                            <TableHead className="font-black uppercase text-[9px] tracking-widest">Extra</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {childrenInGroup.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-6 italic text-muted-foreground">Sin niños en esta categoría.</TableCell></TableRow>
                          ) : (
                            childrenInGroup.map((child, idx) => (
                              <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-none h-12">
                                <TableCell className="font-black text-sm">{child.name}</TableCell>
                                <TableCell className="text-[11px] font-bold uppercase text-muted-foreground">Familia {child.familyName}</TableCell>
                                <TableCell>
                                  {child.guitarSelected && <Badge className="bg-accent text-white font-black text-[8px]"><Music className="w-2 h-2 mr-1" /> GUITARRA</Badge>}
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

        {/* SIDEBAR CONFIG */}
        <div className="space-y-6">
          <Card className={cn(
            "rounded-2xl border-2 shadow-lg transition-all sticky top-24",
            isEditing ? 'border-primary shadow-primary/10' : 'border-dashed bg-muted/5'
          )}>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className={cn("w-4 h-4", isEditing ? 'text-primary' : 'text-muted-foreground')} />
                <CardTitle className="text-xs font-black uppercase tracking-widest">Ajustes de Reunión</CardTitle>
              </div>
              {isEditing && (
                <Button variant="ghost" size="icon" onClick={() => setEditAgeGroups([...editAgeGroups, { label: 'Nuevo', minMonths: 0, maxMonths: 144, allowsGuitar: false }])} className="h-6 w-6">
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {(isEditing ? editAgeGroups : meeting.ageGroups)?.map((group: any, idx: number) => (
                <div key={idx} className={cn(
                  "flex flex-col gap-2 pb-4 last:pb-0 last:border-0 border-b",
                  isEditing ? 'bg-primary/5 p-3 rounded-xl border-none' : ''
                )}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Input value={group.label} onChange={e => updateAgeGroup(idx, 'label', e.target.value)} className="h-8 font-black text-xs uppercase bg-white" />
                        <Button variant="ghost" size="icon" onClick={() => setEditAgeGroups(editAgeGroups.filter((_, i) => i !== idx))} className="h-6 w-6 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">Mín (años)</Label>
                          <Input type="number" step="0.1" value={group.minMonths / 12} onChange={e => updateAgeGroup(idx, 'minMonths', parseFloat(e.target.value) * 12)} className="h-8 text-xs bg-white" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase">Máx (años)</Label>
                          <Input type="number" step="0.1" value={group.maxMonths / 12} onChange={e => updateAgeGroup(idx, 'maxMonths', parseFloat(e.target.value) * 12)} className="h-8 text-xs bg-white" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-[10px] font-black uppercase">Guitarra</Label>
                        <Switch checked={group.allowsGuitar} onCheckedChange={val => updateAgeGroup(idx, 'allowsGuitar', val)} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase">{group.label}</span>
                        {group.allowsGuitar && <Music className="w-3 h-3 text-accent" />}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">
                        {group.minMonths / 12} a {group.maxMonths / 12} años
                      </span>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIÁLOGO DE EXPORTACIÓN */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
              <FileDown className="w-6 h-6" />
              Exportar Listado
            </DialogTitle>
            <DialogDescription className="font-bold">
              Selecciona las columnas para el CSV. Los nombres incluirán tildes y eñes correctamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-3 py-6">
            {EXPORT_COLUMNS.map((col) => (
              <div key={col.id} className={cn("flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer", selectedColumns.includes(col.id) ? 'border-primary/20 bg-primary/5' : 'border-transparent bg-muted/5 opacity-60')} onClick={() => setSelectedColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id])}>
                <Checkbox id={col.id} checked={selectedColumns.includes(col.id)} className="w-5 h-5 rounded-md" />
                <Label htmlFor={col.id} className="text-sm font-black uppercase cursor-pointer flex-1">{col.label}</Label>
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
