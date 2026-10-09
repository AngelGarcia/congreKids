"use client";

import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Baby, Users, Calendar, ShieldCheck, HeartHandshake, Music, MessageCircle, FileDown, Wand2, Smartphone, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        
        <Link href="/" className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver al inicio
        </Link>

        <div className="text-center space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase text-primary leading-none">Guía de Ayuda</h1>
          <p className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Todo lo que necesitas saber sobre CongreKids</p>
        </div>

        <Tabs defaultValue="families" className="space-y-8">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto h-14 rounded-2xl p-1 bg-muted/20 border-2">
            <TabsTrigger value="families" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" /> Familias
            </TabsTrigger>
            <TabsTrigger value="admins" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
              <ShieldCheck className="w-4 h-4 mr-2" /> Admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="families" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Smartphone className="w-6 h-6" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Acceso y Registro</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Card className="rounded-[2rem] border-none shadow-lg">
                  <CardContent className="p-6 space-y-3">
                    <p className="font-bold text-sm leading-relaxed">
                      Puedes entrar con tu cuenta de <span className="text-primary">Google</span> o mediante <span className="text-primary">Email y Contraseña</span>. 
                    </p>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-800 uppercase leading-normal">
                        Nota para iPhone: Si Google da problemas por la privacidad de Safari, te recomendamos usar el acceso por Email. Es 100% fiable.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" /> Perfil Familiar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Al entrar por primera vez, deberás configurar tu familia:</p>
                    <ul className="space-y-2 text-sm font-bold">
                      <li className="flex gap-2"><span className="text-primary">•</span> Define si eres Papá o Mamá.</li>
                      <li className="flex gap-2"><span className="text-primary">•</span> Busca tus apellidos. Si no existen, crea tu nueva familia.</li>
                      <li className="flex gap-2"><span className="text-primary">•</span> El segundo cónyuge debe buscar los mismos apellidos para unirse.</li>
                      <li className="flex gap-2"><span className="text-primary">•</span> Añade a tus hijos con su fecha de nacimiento correcta.</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" /> Inscripciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Cómo apuntarse a las reuniones de los viernes:</p>
                    <ul className="space-y-2 text-sm font-bold">
                      <li className="flex gap-2"><span className="text-primary">•</span> En la pantalla de inicio aparecerá la próxima reunión.</li>
                      <li className="flex gap-2"><span className="text-primary">•</span> Selecciona qué hijos asistirán.</li>
                      <li className="flex gap-2"><span className="text-primary">•</span> Si el grupo de edad lo permite, podrás marcar si llevarán <span className="text-accent">Guitarra</span>.</li>
                      <li className="flex gap-2"><span className="text-primary">•</span> Pulsa "Confirmar Asistencia" para guardar. ¡Puedes cambiarlo hasta que se cierre el plazo!</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="admins" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheck className="w-6 h-6" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Gestión de Administración</h2>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <Card className="rounded-[2rem] border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-primary" /> Calendario Automático
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      No necesitas crear las reuniones una a una. En "Nueva Reunión" tienes un generador que crea todos los viernes del mes seleccionado con un solo clic, configurando automáticamente las horas y los plazos de inscripción.
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                      <HeartHandshake className="w-5 h-5 text-primary" /> Agenda de Monitores
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Mantén un listado de voluntarios. Puedes marcar quién está disponible o no cada semana. Dentro de cada reunión, podrás asignar monitores específicos a cada grupo de edad para tener controlado el ratio niños/monitor.
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-primary" /> Comunicación y Datos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <ul className="space-y-2 text-sm font-bold">
                      <li className="flex gap-2">
                        <span className="text-primary">WhatsApp:</span> Envía los listados de niños por grupos directamente a los grupos de monitores con un formato profesional.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">Excel/CSV:</span> Exporta todos los datos de una reunión para trabajar con ellos o archivarlos.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">Mantenimiento:</span> El sistema te avisará si hay familias "invisibles" (sin índice de búsqueda) y te permitirá repararlas con un botón.
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </section>
          </TabsContent>
        </Tabs>

        <section className="pt-10">
          <div className="bg-primary/5 p-8 rounded-[2.5rem] text-center space-y-4 border-2 border-primary/10">
            <HeartHandshake className="w-10 h-10 text-primary mx-auto" />
            <h3 className="text-xl font-black uppercase tracking-tighter">¿Necesitas algo más?</h3>
            <p className="text-sm font-bold text-muted-foreground">
              Esta aplicación ha sido diseñada para facilitar el servicio en nuestra congregación. Si detectas algún error o tienes sugerencias, contacta con los administradores.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
