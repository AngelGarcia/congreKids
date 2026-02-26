
"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, LayoutDashboard, User } from 'lucide-react';

export default function Navbar() {
  const { user, userData, logout } = useAuth();

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg rotate-3">
            <span className="font-black text-xl">C</span>
          </div>
          <span className="text-xl font-black text-primary tracking-tighter">CongreKids</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            {userData?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="hidden sm:flex font-bold">
                  Admin
                </Button>
              </Link>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-primary/10 p-0 overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user.photoURL || ''} />
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                      {user.displayName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 mt-2 p-2 rounded-2xl shadow-2xl" align="end">
                <DropdownMenuLabel className="p-4">
                  <p className="font-black truncate">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userData?.role === 'admin' && (
                  <DropdownMenuItem asChild className="rounded-xl h-12">
                    <Link href="/admin">
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      <span className="font-bold">Panel Admin</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => logout()} className="rounded-xl h-12 text-destructive focus:text-destructive">
                  <LogOut className="mr-3 h-5 w-5" />
                  <span className="font-bold">Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
