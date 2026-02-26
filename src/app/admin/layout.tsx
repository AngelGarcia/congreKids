"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter
} from '@/components/ui/sidebar';
import { Calendar, PlusCircle, Users, LayoutDashboard, ChevronLeft, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userData, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!userData || userData.role !== 'admin')) {
      router.push('/');
    }
  }, [userData, loading, router]);

  if (loading || !userData || userData.role !== 'admin') {
    return <div className="h-screen flex items-center justify-center">Protegiendo área de administración...</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar className="border-r border-sidebar-border shadow-xl">
          <SidebarHeader className="p-6">
            <Link href="/" className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 bg-white text-primary rounded-full flex items-center justify-center font-bold">C</div>
              <span className="text-xl font-bold tracking-tighter">CongreKids Admin</span>
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin">
                    <LayoutDashboard />
                    <span>Inicio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/meetings">
                    <Calendar />
                    <span>Reuniones</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/meetings/new">
                    <PlusCircle />
                    <span>Nueva Reunión</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Separator className="my-2 bg-sidebar-border/50" />
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <Users />
                  <span>Monitores (Próximamente)</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <SidebarMenuButton onClick={() => logout()} className="text-white/80 hover:text-white">
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col bg-background overflow-auto">
          <header className="h-16 border-b flex items-center px-6 bg-white shrink-0">
            <SidebarTrigger className="mr-4" />
            <Link href="/" className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Volver a vista padre
            </Link>
          </header>
          <div className="p-8">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
