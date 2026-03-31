"use client";

import { useEffect, useState, use } from "react";
import { Package, Truck, CheckCircle2, Clock, MapPin, Search, ArrowRight, ShieldCheck } from "lucide-react";

const STEPS = [
  { status: "PENDING", label: "Order Placed", icon: Clock },
  { status: "SHIPMENT_CREATED", label: "Label Created", icon: Package },
  { status: "IN_TRANSIT", label: "In Transit", icon: Truck },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
  { status: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
];

function TrackingStatus({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STEPS.findIndex(s => s.status === currentStatus);
  const activeIndex = currentIndex === -1 ? 1 : currentIndex; // Default to 'Label Created' if not found but has AWB

  return (
    <div className="relative flex justify-between items-center w-full px-4 mb-12">
      <div className="absolute top-[18px] left-[10%] right-[10%] h-[2px] bg-slate-100 -z-10" />
      <div 
        className="absolute top-[18px] left-[10%] h-[2px] bg-indigo-500 transition-all duration-1000 -z-10" 
        style={{ width: `${(activeIndex / (STEPS.length - 1)) * 80}%` }}
      />
      
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i <= activeIndex;
        const isCurrent = i === activeIndex;

        return (
          <div key={step.status} className="flex flex-col items-center group">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500
              ${isCompleted ? "bg-indigo-600 border-indigo-100 text-white shadow-lg shadow-indigo-100" : "bg-white border-slate-50 text-slate-300"}`}
            >
              <Icon className={`w-4 h-4 ${isCurrent ? "animate-pulse" : ""}`} />
            </div>
            <p className={`text-[10px] sm:text-xs font-bold mt-3 uppercase tracking-wider transition-colors duration-500
              ${isCompleted ? "text-slate-900" : "text-slate-400"}`}
            >
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function PublicTrackingPage({ params }: { params: Promise<{ awb: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracking();
  }, [resolvedParams.awb]);

  const fetchTracking = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/track/${resolvedParams.awb}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || "Shipment not found");
      }
    } catch (err) {
      setError("Failed to load tracking information");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-medium animate-pulse">Locating your shipment...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Shipment Not Found</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            We couldn't find any tracking information for <span className="font-mono font-bold text-slate-900">{resolvedParams.awb}</span>.
            Please double-check the tracking number provided by the sender.
          </p>
          <button 
            onClick={() => window.location.href = "/"}
            className="inline-flex items-center text-indigo-600 font-bold hover:gap-2 transition-all p-2"
          >
            Go to Homepage <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Premium Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tracking Number</p>
              <h1 className="text-xl font-mono font-bold text-slate-900">{data.awb}</h1>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="inline-flex items-center px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              {data.status.replace(/_/g, " ")}
            </div>
            <p className="text-xs text-slate-400">Order Ref: {data.shopifyOrderName}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Visual Steps Card */}
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm">
              <TrackingStatus currentStatus={data.status} />
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-start gap-4">
                <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Authenticated Shipment</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    This shipment is being handled by <span className="text-indigo-600 font-bold uppercase">{data.courier || "Internal"} Logistics</span>. 
                    Tracking data is updated in real-time from the dispatch center.
                  </p>
                </div>
              </div>
            </div>

            {/* Public Timeline Section */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-8 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                Full Journey Timeline
              </h3>
              <div className="space-y-10">
                {data.trackingEvents.map((event: any, i: number) => (
                  <div key={event.id} className="relative pl-10 group">
                    {i !== data.trackingEvents.length - 1 && (
                      <div className="absolute left-[7px] top-6 w-[2px] h-full bg-slate-50" />
                    )}
                    <div className={`absolute left-0 top-1.5 w-[16px] h-[16px] rounded-full border-4 border-white shadow-sm ring-2
                      ${i === 0 ? "bg-indigo-600 ring-indigo-50" : "bg-slate-200 ring-slate-50"}`} 
                    />
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <p className={`font-bold text-sm ${i === 0 ? "text-slate-900" : "text-slate-500"}`}>
                          {event.status.replace(/_/g, " ")}
                        </p>
                        <time className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded uppercase">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </time>
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3 h-3" />
                        {event.location || "System"} • {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {event.description && (
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Delivery Info Mini-Card */}
            <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl shadow-indigo-200 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />
               <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/5 rounded-full" />
               
               <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-6 relative z-10">Consignee Info</h3>
               <div className="space-y-6 relative z-10">
                 <div>
                   <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1 shadow-sm">Customer Name</p>
                   <p className="text-lg font-bold">{data.customerName}</p>
                 </div>
                 <div className="pt-6 border-t border-white/10">
                   <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-2">Delivery Area</p>
                   <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                       <MapPin className="w-4 h-4 text-indigo-200" />
                     </div>
                     <p className="text-sm font-medium leading-relaxed">
                       {data.city}, {data.state}<br/>
                       <span className="text-xs text-indigo-200">PIN: {data.pincode}</span>
                     </p>
                   </div>
                 </div>
               </div>
            </div>

            {/* Help / Support Mini-Card */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
              <p className="text-xs font-bold text-slate-900 mb-2">Need help with your shipment?</p>
              <p className="text-xs text-slate-400 mb-6 font-medium">Contact our support desk for detailed queries.</p>
              <button className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                Contact Logistics Support
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Branded Footer */}
      <footer className="text-center mt-auto py-10 opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
          ThunderX <span className="h-[1px] w-4 bg-slate-900" /> Logistics Intelligence
        </p>
      </footer>
    </div>
  );
}
