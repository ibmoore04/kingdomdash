import React from 'react';
import { MessageCircle, Phone, HelpCircle, Shield, CheckCircle2, Bike } from 'lucide-react';

export interface WhatsappDispatchBridgeProps {
  orderNumber: string;
  customerName?: string;
  deliveryAddress?: string;
  vendorName?: string;
  riderName?: string | null;
  riderPhone?: string | null;
  supportPhone?: string;
  className?: string;
}

export const WhatsappDispatchBridge: React.FC<WhatsappDispatchBridgeProps> = ({
  orderNumber,
  customerName = 'Customer',
  deliveryAddress = 'Delivery Destination',
  vendorName = 'Kitchen Store',
  riderName,
  riderPhone,
  supportPhone = '+2348077958755',
  className = '',
}) => {
  // Format numbers for wa.me link (remove +, -, spaces)
  const sanitizePhoneForWa = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '234' + clean.slice(1);
    }
    return clean;
  };

  const riderWaNumber = riderPhone ? sanitizePhoneForWa(riderPhone) : '';
  const supportWaNumber = sanitizePhoneForWa(supportPhone);

  const riderMessage = encodeURIComponent(
    `Hello ${riderName || 'Courier'}! I am tracking my KingdomDash Order #${orderNumber} from ${vendorName}.\nDestination: ${deliveryAddress}.\nPlease ping me as soon as you arrive at the gate.`
  );

  const supportMessage = encodeURIComponent(
    `Hello KingdomDash Dispatch Support! I need assistance with Order #${orderNumber} for ${customerName}.\nAddress: ${deliveryAddress}.`
  );

  const riderWaUrl = riderWaNumber ? `https://wa.me/${riderWaNumber}?text=${riderMessage}` : '#';
  const supportWaUrl = `https://wa.me/${supportWaNumber}?text=${supportMessage}`;

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-xs space-y-3.5 sm:space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#25D366]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
              Direct WhatsApp Dispatch Bridge
            </h4>
            <p className="text-[11px] sm:text-xs text-neutral-500">
              1-tap encrypted chat with your assigned courier and live support
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Shield className="w-3 h-3 text-[#25D366]" /> End-to-End Encrypted
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Chat with Rider OR Awaiting Assignment State */}
        {riderName ? (
          <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 flex flex-col justify-between space-y-3.5 transition-all">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                <span>Assigned Courier</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified Rider
                </span>
              </div>
              <div className="text-sm font-bold text-neutral-900">{riderName}</div>
              {riderPhone && <div className="text-xs text-neutral-500 font-mono">{riderPhone}</div>}
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-1">
                <Bike className="w-3.5 h-3.5 text-neutral-400" />
                <span>Express Motorcycle Dispatch</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={riderWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-11 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white text-[#25D366]" />
                <span>Chat on WhatsApp</span>
              </a>
              {riderPhone && (
                <a
                  href={`tel:${riderPhone}`}
                  className="w-11 h-11 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 active:scale-[0.98] text-neutral-700 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-2xs"
                  title="Call courier directly"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 flex flex-col justify-between space-y-3.5">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                <span>Assigned Courier</span>
                <span className="font-semibold text-amber-600">Awaiting Dispatch</span>
              </div>
              <div className="text-sm font-bold text-neutral-900">Matching Nearby Courier</div>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                A verified dispatch rider will be assigned once the merchant prepares your package.
              </p>
            </div>

            <div className="pt-1 flex items-center gap-2 text-xs text-neutral-600 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Central dispatch matching active</span>
            </div>
          </div>
        )}

        {/* Chat with Support Dispatch */}
        <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 flex flex-col justify-between space-y-3.5">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
              <span>Central Dispatch</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Live Desk
              </span>
            </div>
            <div className="text-sm font-bold text-neutral-900">KingdomDash Support Desk</div>
            <div className="text-xs text-neutral-500 mt-0.5">24/7 Ijebu-Ode Fleet Dispatchers</div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href={supportWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-11 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Support WhatsApp</span>
            </a>
            <a
              href={`tel:${supportPhone}`}
              className="w-11 h-11 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 active:scale-[0.98] text-neutral-700 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-2xs"
              title="Call support hotline"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
