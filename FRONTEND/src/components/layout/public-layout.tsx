import { Outlet } from 'react-router-dom'
import { AnnouncementBar } from '@/components/layout/announcement-bar'
import { Navbar } from '@/components/layout/navbar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Footer } from '@/components/layout/footer'
import { CartDrawer } from '@/components/cart/cart-drawer'
import { FloatingCartBar } from '@/components/cart/floating-cart-bar'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <AnnouncementBar />
      <Navbar />
      <BottomNav />
      <FloatingCartBar />
      <CartDrawer />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

