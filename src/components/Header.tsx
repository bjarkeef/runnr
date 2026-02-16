'use client';

import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { user, loading, isSyncing } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  const pathname = usePathname() || '/';

  const navItems = [
    { href: '/runs', label: 'Runs' },
    { href: '/gear', label: 'Gear' },
    { href: '/race-predictions', label: 'Race Predictions' },
    { href: '/route-planner', label: 'Route Planner' },
    { href: '/stats', label: 'Stats' },
    { href: '/heatmap', label: 'Heatmap' },
  ];

  const NavigationItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        return (
          <Button
            key={item.href}
            variant="ghost"
            asChild
            className={mobile ? "justify-start w-full h-12" : "justify-start w-full md:w-auto"}
          >
            <Link
              href={item.href}
              onClick={() => setIsOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`${mobile ? 'flex flex-col items-start gap-1' : 'flex flex-col items-center gap-1'} transition-colors`}
            >
              <span className={`text-sm transition-colors ${active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}</span>
            </Link>
          </Button>
        );
      })}

      <Button variant="ghost" asChild className={mobile ? "justify-start w-full h-12" : "justify-start w-full md:w-auto"}>
        <a href="/api/auth/logout">Logout</a>
      </Button>
    </>
  );

  return (
    <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b border-border">
      <nav className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        <Link href="/" className="text-xl md:text-2xl font-bold text-primary flex items-center gap-2">
          Runnr
          {isSyncing && (
            <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Syncing...
            </span>
          )}
        </Link>
        
        {loading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        ) : user ? (
          <>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <NavigationItems mobile={false} />
              <Link href="/settings" className="ml-2">
                <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                  <AvatarImage src={user.profile_medium} alt={`${user.firstname} ${user.lastname}`} />
                  <AvatarFallback>{user.firstname.charAt(0)}{user.lastname.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
            </div>

            {/* Mobile Navigation */}
            <div className="flex md:hidden items-center gap-3">
              <Link href="/settings">
                <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                  <AvatarImage src={user.profile_medium} alt={`${user.firstname} ${user.lastname}`} />
                  <AvatarFallback>{user.firstname.charAt(0)}{user.lastname.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <div className="flex flex-col gap-3 mt-8">
                    <div className="flex items-center gap-4 px-4 pb-6 border-b">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profile_medium} alt={`${user.firstname} ${user.lastname}`} />
                        <AvatarFallback className="text-sm">{user.firstname.charAt(0)}{user.lastname.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.firstname} {user.lastname}</p>
                        <p className="text-xs text-muted-foreground">Strava Connected</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <NavigationItems mobile={true} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/login">Login with Strava</a>
          </Button>
        )}
      </nav>
    </header>
  );
}
