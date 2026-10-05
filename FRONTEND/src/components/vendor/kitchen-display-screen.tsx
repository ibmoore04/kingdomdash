import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  CheckCircle2,
  Flame,
  Package,
  AlertCircle,
  FileText,
  Check,
} from 'lucide-react';
import { playKitchenOrderChime } from '@/utils/audio-chime';
import { formatNgn } from '@/utils/formatting';

export interface KitchenTicketItem {
  id: string;
  name: string;
  quantity: number;
  instructions?: string;
  completed?: boolean;
}

export interface KitchenTicket {
  id: string;
  orderNumber: string;
  customerName: string;
  placedTime: string;
  targetPrepMinutes: number;
  status: 'payment_confirmed' | 'preparing' | 'ready_for_pickup';
  specialInstructions?: string | null;
  items: KitchenTicketItem[];
}

const DEFAULT_TICKETS: KitchenTicket[] = [
  {
    id: 't-101',
    orderNumber: 'KD-FD084',
    customerName: 'Bisi Johnson',
    placedTime: '12:35 PM',
    targetPrepMinutes: 20,
    status: 'preparing',
    specialInstructions: 'Extra pepper, please separate stew from jollof rice.',
    items: [
      { id: 'i-1', name: 'Party Jollof Rice & Crispy Chicken Combo', quantity: 2, instructions: 'Spicy stew separate' },
      { id: 'i-2', name: 'Golden Fried Dodo (Plantain)', quantity: 2 },
      { id: 'i-3', name: 'Chilled Hibiscus (Zobo) 500ml', quantity: 1 },
    ],
  },
  {
    id: 't-102',
    orderNumber: 'KD-FD085',
    customerName: 'Akanbi Ibrahim',
    placedTime: '12:42 PM',
    targetPrepMinutes: 15,
    status: 'payment_confirmed',
    specialInstructions: 'Pack in thermal foil container, client is waiting.',
    items: [
      { id: 'i-4', name: 'Special Fried Rice & Peppered Turkey', quantity: 1 },
      { id: 'i-5', name: 'Fresh Coleslaw Salad', quantity: 1 },
    ],
  },
  {
    id: 't-103',
    orderNumber: 'KD-FD083',
    customerName: 'Ngozi Eze',
    placedTime: '12:20 PM',
    targetPrepMinutes: 25,
    status: 'ready_for_pickup',
    items: [
      { id: 'i-6', name: 'Fisherman Fresh Catfish Pepper Soup', quantity: 1 },
      { id: 'i-7', name: 'Extra Boiled White Yam Slices', quantity: 2 },
    ],
  },
];

interface KitchenDisplayScreenProps {
  initialTickets?: KitchenTicket[];
  onUpdateStatus?: (ticketId: string, nextStatus: KitchenTicket['status']) => void;
  isOpenModal?: boolean;
  onClose?: () => void;
}

export const KitchenDisplayScreen: React.FC<KitchenDisplayScreenProps> = ({
  initialTickets,
  onUpdateStatus,
  isOpenModal = false,
  onClose,
}) => {
  const [tickets, setTickets] = useState<KitchenTicket[]>(initialTickets || DEFAULT_TICKETS);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState<'all' | 'preparing' | 'ready'>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const handleToggleSound = () => {
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      playKitchenOrderChime();
    }
  };

  const handleTestChime = () => {
    playKitchenOrderChime();
  };

  const handleItemToggle = (itemId: string) => {
    setCheckedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAdvanceStatus = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const nextStatus = t.status === 'payment_confirmed' ? 'preparing' : 'ready_for_pickup';
          if (onUpdateStatus) {
            onUpdateStatus(ticketId, nextStatus);
          }
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'preparing') return t.status === 'preparing' || t.status === 'payment_confirmed';
    if (filter === 'ready') return t.status === 'ready_for_pickup';
    return true;
  });

  return (
    <div
      className={`rounded-3xl border border-neutral-800 bg-[#0F1218] text-white overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative'
      }`}
    >
      {/* Top KDS Header Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Kitchen Display System (KDS)
              </h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Live Kitchen Mode
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Interactive prep tickets, cooking countdown, and audio alert notifications
            </p>
          </div>
        </div>

        {/* Filter Pills and Sound Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-neutral-800 rounded-xl text-xs font-semibold">
            {(['all', 'preparing', 'ready'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  filter === tab
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All Tickets' : tab}
              </button>
            ))}
          </div>

          {/* Audio Chime Controls */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700'
            }`}
            title={soundEnabled ? 'Kitchen Chime Active' : 'Kitchen Chime Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime Active' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestChime}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 transition-colors"
            title="Test alert sound"
          >
            Test Sound
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Toggle fullscreen display"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* Ticket Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-h-[75vh] overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full py-16 text-center text-neutral-500">
            <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No active kitchen tickets for this filter.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isCooking = ticket.status === 'preparing';
            const isReady = ticket.status === 'ready_for_pickup';
            const isPending = ticket.status === 'payment_confirmed';

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border flex flex-col justify-between transition-all ${
                  isReady
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : isCooking
                    ? 'border-amber-500/50 bg-neutral-900/90'
                    : 'border-blue-500/40 bg-neutral-900/70'
                }`}
              >
                {/* Ticket Header */}
                <div className="p-4 border-b border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-black text-amber-400">
                      {ticket.orderNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isReady
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isCooking
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {isReady ? 'Ready for Pickup' : isCooking ? 'Cooking Now' : 'Confirmed'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-semibold text-neutral-200">{ticket.customerName}</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      {ticket.placedTime}
                    </span>
                  </div>

                  {ticket.specialInstructions && (
                    <div className="mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{ticket.specialInstructions}</span>
                    </div>
                  )}
                </div>

                {/* Items Checklist */}
                <div className="p-4 space-y-2.5 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
                    Recipe & Packing Checklist ({ticket.items.length} items)
                  </div>
                  {ticket.items.map((item) => {
                    const isDone = checkedItems[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemToggle(item.id)}
                        className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                          isDone
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-neutral-400 line-through'
                            : 'bg-neutral-800/60 border-neutral-700/60 hover:bg-neutral-800 text-neutral-100'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-neutral-500 bg-neutral-900'
                            }`}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold leading-snug">
                              {item.quantity}x {item.name}
                            </div>
                            {item.instructions && (
                              <div className="text-[10px] text-amber-400/90 font-medium">
                                Note: {item.instructions}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ticket Action Button */}
                <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(ticket.id)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-neutral-950 flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Start Cooking</span>
                    </button>
                  )}

                  {isCooking && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(ticket.id)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                    >
                      <Package className="w-4 h-4" />
                      <span>Mark Ready for Courier</span>
                    </button>
                  )}

                  {isReady && (
                    <div className="py-2 text-center text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Awaiting Courier Pickup</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
