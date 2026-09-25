import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { 
  Plus, 
  Trash2, 
  Camera, 
  FileText, 
  Download, 
  RotateCcw, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SecurityReport, Observation, ShiftInfo } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = 'security_report_v1';

const INITIAL_STATE: SecurityReport = {
  metadata: {
    valueOfDay: 'Teamwork',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    reportBy: '',
    shiftInCharge: '',
    firstResponderRoster: '',
    morningShift: { inCharge: '', name: '' },
    afternoonShift: { inCharge: '', name: '' },
    nightShift: { inCharge: '', name: '' },
  },
  tasks: {
    guestLocks: '',
    electricSafe: '',
    dndRooms: '',
    mechanicalRoom: '',
    overnightVehicles: {
      guest2W: '',
      guest4W: '',
      staff2W: '',
      staff4W: '',
    },
    staffDeclarations: '',
    lostFound: '',
    incidentAccident: '',
    specialEvents: '',
    trainingDrills: '',
    inspectionsAlcohol: '',
    friskingRecovery: '',
    singleLady: '',
  },
  openDoors: [],
  gadgetStatus: [
    { gadget: 'X Ray machines', remark: 'Normal Condition' },
    { gadget: 'Emergency supplies', remark: 'Normal Condition' },
    { gadget: 'CCTV Status', remark: 'Normal Condition' },
    { gadget: 'Boom Barriers', remark: 'Normal Condition' },
    { gadget: 'ANPR', remark: 'Normal Condition' },
    { gadget: 'DFMD/MSD', remark: 'Working condition' },
  ],
  keyDiscrepancies: [],
  pickUpDown: [],
  garbage: {
    time: '',
    vehicleNo: '',
    dryWeight: '',
    dryBags: '',
    cartoonWeight: '',
    wetWeight: '',
    wetBags: '',
    foundItems: 'NIL',
    foundPhoto: null,
    foundRemarks: '',
    checkedBy: '',
  },
  alarms: {
    fireAlarms: '0',
    gasAlarms: '0',
    panicBuzzer: '0',
    facp: {
      alarm: '0',
      trouble: '0',
      supervisory: '0',
      monitors: '0',
    },
    alarmDetails: '',
  },
  observations: [],
};

export default function App() {
  const [data, setData] = useState<SecurityReport>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge with INITIAL_STATE to ensure new nested fields exist
        return {
          ...INITIAL_STATE,
          ...parsed,
          metadata: { ...INITIAL_STATE.metadata, ...parsed.metadata },
          tasks: { 
            ...INITIAL_STATE.tasks, 
            ...parsed.tasks,
            overnightVehicles: typeof parsed.tasks?.overnightVehicles === 'object' 
              ? { ...INITIAL_STATE.tasks.overnightVehicles, ...parsed.tasks.overnightVehicles }
              : INITIAL_STATE.tasks.overnightVehicles
          },
          alarms: { 
            ...INITIAL_STATE.alarms, 
            ...parsed.alarms,
            facp: { ...INITIAL_STATE.alarms.facp, ...(parsed.alarms?.facp || {}) }
          }
        };
      }
      return INITIAL_STATE;
    } catch {
      return INITIAL_STATE;
    }
  });
  
  const [activeSection, setActiveSection] = useState<string>('metadata');
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const resetData = () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      setData(INITIAL_STATE);
      setActiveSection('metadata');
    }
  };

  const updateMetadata = (field: string, value: string) => {
    setData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value }
    }));
  };

  const updateShift = (shift: 'morningShift' | 'afternoonShift' | 'nightShift', field: string, value: string) => {
    setData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [shift]: { ...prev.metadata[shift], [field]: value }
      }
    }));
  };

  const updateTask = (field: keyof SecurityReport['tasks'], value: string) => {
    setData(prev => ({
      ...prev,
      tasks: { ...prev.tasks, [field]: value }
    }));
  };

  const addRow = (section: 'openDoors' | 'keyDiscrepancies' | 'pickUpDown' | 'observations') => {
    if (section === 'openDoors') {
      setData(prev => ({
        ...prev,
        openDoors: [...prev.openDoors, { room: '', status: '', remark: '' }]
      }));
    } else if (section === 'keyDiscrepancies') {
      setData(prev => ({
        ...prev,
        keyDiscrepancies: [...prev.keyDiscrepancies, { keyNo: '', doorName: '', department: '', issuer: '', date: '', time: '', contact: '' }]
      }));
    } else if (section === 'pickUpDown') {
      setData(prev => ({
        ...prev,
        pickUpDown: [...prev.pickUpDown, { time: '', maleStaff: '', femaleStaff: '', chauffeur: '', vehicle: '', remarks: '' }]
      }));
    } else if (section === 'observations') {
      const newObs: Observation = {
        id: crypto.randomUUID(),
        location: '',
        department: '',
        photo: null,
        status: ''
      };
      setData(prev => ({
        ...prev,
        observations: [...prev.observations, newObs]
      }));
    }
  };

  const removeRow = (section: keyof SecurityReport, index: number) => {
    setData(prev => ({
      ...prev,
      [section]: (prev[section] as any[]).filter((_: any, i: number) => i !== index)
    }));
  };

  const handleGarbageImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const targetRatio = 16 / 9;
        let sourceWidth = img.width;
        let sourceHeight = img.height;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceWidth / sourceHeight > targetRatio) {
          sourceWidth = sourceHeight * targetRatio;
          sourceX = (img.width - sourceWidth) / 2;
        } else {
          sourceHeight = sourceWidth / targetRatio;
          sourceY = (img.height - sourceHeight) / 2;
        }

        canvas.width = 800;
        canvas.height = 450;
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 800, 450);
        
        setData(prev => ({
          ...prev,
          garbage: { ...prev.garbage, foundPhoto: canvas.toDataURL('image/jpeg', 0.8) }
        }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const targetRatio = 16 / 9;
        let sourceWidth = img.width;
        let sourceHeight = img.height;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceWidth / sourceHeight > targetRatio) {
          sourceWidth = sourceHeight * targetRatio;
          sourceX = (img.width - sourceWidth) / 2;
        } else {
          sourceHeight = sourceWidth / targetRatio;
          sourceY = (img.height - sourceHeight) / 2;
        }

        canvas.width = 1280;
        canvas.height = 720;
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
        
        const b64 = canvas.toDataURL('image/jpeg', 0.8);
        setData(prev => ({
          ...prev,
          observations: prev.observations.map(obs => obs.id === id ? { ...obs, photo: b64 } : obs)
        }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const generatePDF = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    if (pdfRef.current) {
      try {
        const reportElement = pdfRef.current.querySelector('.pdf-report-main') as HTMLElement;
        if (!reportElement) return;

        const canvas = await html2canvas(reportElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc) => {
            const el = clonedDoc.body;
            if (el) {
              el.style.colorScheme = 'light';
              const allElements = clonedDoc.querySelectorAll('*');
              allElements.forEach((node) => {
                const style = (node as HTMLElement).style;
                if (style) {
                  style.letterSpacing = '0px';
                  style.fontVariantLigatures = 'none';
                  style.textRendering = 'optimizeSpeed';
                }
              });
            }
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width; // mm

        const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight]);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

        const fileName = `Hilton_Security_Report_${data.metadata.date.replace(/\//g, '-')}.pdf`;
        pdf.save(fileName);
      } catch (error) {
        console.error('PDF Generation failed', error);
        alert('Failed to generate PDF. Please try again.');
      }
    }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 px-4 py-3 flex justify-between items-center bg-opacity-95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="bg-red-600 p-1.5 rounded-lg text-white">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none text-slate-900">Hilton DSR</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">SECURITY REPORTING</p>
          </div>
        </div>
        <div className="flex gap-2 text-slate-900">
          <button 
            onClick={resetData}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Reset All Data"
          >
            <RotateCcw size={20} />
          </button>
          <button 
            onClick={generatePDF}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm active:scale-95"
          >
            {isGenerating ? 'Processing...' : (
              <>
                <Download size={18} />
                <span className="hidden sm:inline">Save Report</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto pt-16 space-y-6">
        {/* Section Navigation */}
        <div className="flex overflow-x-auto gap-2 py-2 no-scrollbar border-b border-slate-200">
          {[
            { id: 'metadata', label: 'Info' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'checks', label: 'Checks' },
            { id: 'logistics', label: 'Logistics' },
            { id: 'keys', label: 'Keys' },
            { id: 'alarms', label: 'Alarms' },
            { id: 'observations', label: 'Observations' },
          ].map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeSection === section.id 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              )}
            >
              {section.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeSection === 'metadata' && (
            <motion.section 
              key="metadata"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <Input label="Value of The Day" value={data.metadata.valueOfDay} onChange={v => updateMetadata('valueOfDay', v)} />
                <Input label="Date" type="date" value={data.metadata.date} onChange={v => updateMetadata('date', v)} />
                <Input label="Report By" value={data.metadata.reportBy} onChange={v => updateMetadata('reportBy', v)} />
                <Input label="Time" type="time" value={data.metadata.time} onChange={v => updateMetadata('time', v)} />
              </div>
              <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
                <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-widest border-b pb-2">Shift Duties</h3>
                <div className="grid gap-3">
                  <ShiftInput label="Morning Shift" info={data.metadata.morningShift} onChange={(f, v) => updateShift('morningShift', f, v)} />
                  <ShiftInput label="Afternoon Shift" info={data.metadata.afternoonShift} onChange={(f, v) => updateShift('afternoonShift', f, v)} />
                  <ShiftInput label="Night Shift" info={data.metadata.nightShift} onChange={(f, v) => updateShift('nightShift', f, v)} />
                </div>
              </div>
            </motion.section>
          )}

          {activeSection === 'tasks' && (
            <motion.section 
              key="tasks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3 bg-white p-4 rounded-xl border border-slate-200"
            >
              <TaskItem label="1. Guest room locks issues/complaints" value={data.tasks.guestLocks} onChange={v => updateTask('guestLocks', v)} />
              <TaskItem label="2. Electric Safe issues/complaints" value={data.tasks.electricSafe} onChange={v => updateTask('electricSafe', v)} />
              <TaskItem label="3. DND ROOMS" value={data.tasks.dndRooms} onChange={v => updateTask('dndRooms', v)} />
              <TaskItem label="4. Mechanical Room Issue" value={data.tasks.mechanicalRoom} onChange={v => updateTask('mechanicalRoom', v)} />
              
              {/* 5. Over Night Vehicles */}
              <div className="space-y-1 pb-3 border-b border-slate-100 italic">
                <label className="text-xs font-bold text-slate-700 leading-tight block mb-2">5. Over Night Vehicles</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Guest</p>
                    <Input label="Two Wheeler" value={data.tasks.overnightVehicles.guest2W} onChange={v => setData(p => ({ ...p, tasks: { ...p.tasks, overnightVehicles: { ...p.tasks.overnightVehicles, guest2W: v } } }))} condensed />
                    <Input label="Four Wheeler" value={data.tasks.overnightVehicles.guest4W} onChange={v => setData(p => ({ ...p, tasks: { ...p.tasks, overnightVehicles: { ...p.tasks.overnightVehicles, guest4W: v } } }))} condensed />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Staff</p>
                    <Input label="Two Wheeler" value={data.tasks.overnightVehicles.staff2W} onChange={v => setData(p => ({ ...p, tasks: { ...p.tasks, overnightVehicles: { ...p.tasks.overnightVehicles, staff2W: v } } }))} condensed />
                    <Input label="Four Wheeler" value={data.tasks.overnightVehicles.staff4W} onChange={v => setData(p => ({ ...p, tasks: { ...p.tasks, overnightVehicles: { ...p.tasks.overnightVehicles, staff4W: v } } }))} condensed />
                  </div>
                </div>
              </div>

              <TaskItem label="6. Staff Declarations in the night" value={data.tasks.staffDeclarations} onChange={v => updateTask('staffDeclarations', v)} />
              <TaskItem label="7. Lost & Found" value={data.tasks.lostFound} onChange={v => updateTask('lostFound', v)} />
              <TaskItem label="8. Incident/ Acc./ Near miss/ Complain" value={data.tasks.incidentAccident} onChange={v => updateTask('incidentAccident', v)} />
              <TaskItem label="9. Special Events/VVIP movement" value={data.tasks.specialEvents} onChange={v => updateTask('specialEvents', v)} />
              <TaskItem label="10. Training/drills/Simulations" value={data.tasks.trainingDrills} onChange={v => updateTask('trainingDrills', v)} />
              <TaskItem label="11. Inspections/Alcohol tests" value={data.tasks.inspectionsAlcohol} onChange={v => updateTask('inspectionsAlcohol', v)} />
              <TaskItem label="12. Frisking Recovery" value={data.tasks.friskingRecovery} onChange={v => updateTask('friskingRecovery', v)} />
              <TaskItem label="13. Single Lady" value={data.tasks.singleLady} onChange={v => updateTask('singleLady', v)} />
            </motion.section>
          )}

          {activeSection === 'checks' && (
            <motion.section 
              key="checks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Open Doors In Stores/Guest Floors</h3>
                  <button onClick={() => addRow('openDoors')} className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  {data.openDoors.map((door, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 relative group">
                      <button onClick={() => removeRow('openDoors', idx)} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full shadow-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Room / Office" value={door.room} onChange={e => {
                          const next = [...data.openDoors];
                          next[idx].room = e.target.value;
                          setData(prev => ({ ...prev, openDoors: next }));
                        }} className="bg-white border p-2 rounded text-sm outline-none focus:border-slate-400" />
                        <input placeholder="Status" value={door.status} onChange={e => {
                          const next = [...data.openDoors];
                          next[idx].status = e.target.value;
                          setData(prev => ({ ...prev, openDoors: next }));
                        }} className="bg-white border p-2 rounded text-sm outline-none focus:border-slate-400" />
                      </div>
                      <input placeholder="Remark" value={door.remark} onChange={e => {
                        const next = [...data.openDoors];
                        next[idx].remark = e.target.value;
                        setData(prev => ({ ...prev, openDoors: next }));
                      }} className="bg-white border p-2 rounded text-sm outline-none focus:border-slate-400 w-full" />
                    </div>
                  ))}
                  {data.openDoors.length === 0 && <p className="text-center text-slate-400 py-4 text-sm italic">No entries</p>}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">Gadget / System Status</h3>
                <div className="grid gap-2">
                  {data.gadgetStatus.map((gadget, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr,2fr] gap-2 items-center text-sm">
                      <span className="font-medium text-slate-600">{gadget.gadget}</span>
                      <input 
                        value={gadget.remark} 
                        onChange={e => {
                          const next = [...data.gadgetStatus];
                          next[idx].remark = e.target.value;
                          setData(prev => ({ ...prev, gadgetStatus: next }));
                        }}
                        className="bg-slate-50 border p-2 rounded outline-none focus:border-slate-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeSection === 'keys' && (
            <motion.section 
              key="keys"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Key Discrepancy Report</h2>
                <button 
                  onClick={() => addRow('keyDiscrepancies')}
                  className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800"
                >
                  <Plus size={16} />
                  Add Entry
                </button>
              </div>

              <div className="space-y-4">
                {data.keyDiscrepancies.map((kd, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden">
                    <button 
                      onClick={() => removeRow('keyDiscrepancies', idx)}
                      className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all sm:opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <Input label="Key No" value={kd.keyNo} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].keyNo = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                      <Input label="Door/Location" value={kd.doorName} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].doorName = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                      <Input label="Department" value={kd.department} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].department = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                      <Input label="Issuer Name" value={kd.issuer} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].issuer = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <Input label="Date" type="date" value={kd.date} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].date = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                      <Input label="Time" type="time" value={kd.time} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].time = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                      <Input label="Contact No" value={kd.contact} onChange={v => {
                        const next = [...data.keyDiscrepancies];
                        next[idx].contact = v;
                        setData(p => ({ ...p, keyDiscrepancies: next }));
                      }} condensed />
                    </div>
                  </div>
                ))}
                {data.keyDiscrepancies.length === 0 && (
                  <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                    No discrepancies recorded yet.
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeSection === 'logistics' && (
            <motion.section 
              key="logistics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 text-slate-900">Pick Up - Drop Logs</h3>
                  <button onClick={() => addRow('pickUpDown')} className="p-1.5 bg-slate-900 text-white rounded-lg">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  {data.pickUpDown.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg space-y-2 relative group">
                      <button onClick={() => removeRow('pickUpDown', idx)} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full shadow-sm p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Time" type="time" value={item.time} onChange={v => {
                          const next = [...data.pickUpDown];
                          next[idx].time = v;
                          setData(prev => ({ ...prev, pickUpDown: next }));
                        }} condensed />
                        <Input label="Vehicle No" value={item.vehicle} onChange={v => {
                          const next = [...data.pickUpDown];
                          next[idx].vehicle = v;
                          setData(prev => ({ ...prev, pickUpDown: next }));
                        }} condensed />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid grid-cols-2 gap-1 px-1 rounded-lg bg-white/50">
                          <Input label="Male" value={item.maleStaff} onChange={v => {
                            const next = [...data.pickUpDown];
                            next[idx].maleStaff = v;
                            setData(prev => ({ ...prev, pickUpDown: next }));
                          }} condensed />
                          <Input label="Female" value={item.femaleStaff} onChange={v => {
                            const next = [...data.pickUpDown];
                            next[idx].femaleStaff = v;
                            setData(prev => ({ ...prev, pickUpDown: next }));
                          }} condensed />
                        </div>
                        <Input label="Chauffeur" value={item.chauffeur} onChange={v => {
                          const next = [...data.pickUpDown];
                          next[idx].chauffeur = v;
                          setData(prev => ({ ...prev, pickUpDown: next }));
                        }} condensed />
                      </div>
                    </div>
                  ))}
                  {data.pickUpDown.length > 0 && (
                    <div className="mt-4 p-3 bg-slate-900 text-white rounded-xl shadow-lg grid grid-cols-4 gap-2 text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">TOTAL TRIPS</span>
                        <span className="text-xl font-black">{data.pickUpDown.length}</span>
                      </div>
                      <div className="flex flex-col border-l border-slate-700">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">TOTAL MALE</span>
                        <span className="text-xl font-black">{data.pickUpDown.reduce((s, c) => s + (parseInt(c.maleStaff) || 0), 0)}</span>
                      </div>
                      <div className="flex flex-col border-l border-slate-700">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">TOTAL FEMALE</span>
                        <span className="text-xl font-black">{data.pickUpDown.reduce((s, c) => s + (parseInt(c.femaleStaff) || 0), 0)}</span>
                      </div>
                      <div className="flex flex-col border-l border-white/20 bg-white/10 rounded-lg">
                        <span className="text-[10px] text-slate-300 uppercase font-bold">TOTAL MEMBER</span>
                        <span className="text-xl font-black">{data.pickUpDown.reduce((s, c) => s + (parseInt(c.maleStaff) || 0) + (parseInt(c.femaleStaff) || 0), 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b">Garbage Clearance</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Input label="Time" type="time" value={data.garbage.time} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, time: v } }))} />
                  <Input label="Vehicle No" value={data.garbage.vehicleNo} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, vehicleNo: v } }))} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-2 border rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Dry Garbage</span>
                    <Input label="Weight" value={data.garbage.dryWeight} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, dryWeight: v } }))} condensed />
                    <Input label="Bags" value={data.garbage.dryBags} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, dryBags: v } }))} condensed />
                  </div>
                  <div className="p-2 border rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Wet Garbage</span>
                    <Input label="Weight" value={data.garbage.wetWeight} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, wetWeight: v } }))} condensed />
                    <Input label="Bags" value={data.garbage.wetBags} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, wetBags: v } }))} condensed />
                  </div>
                  <div className="p-2 border rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Misc</span>
                    <Input label="Cartoon" value={data.garbage.cartoonWeight} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, cartoonWeight: v } }))} condensed />
                    <Input label="Checked" value={data.garbage.checkedBy} onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, checkedBy: v } }))} condensed />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-500" />
                    Found Items in Garbage
                  </h4>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                    <Input 
                      label="Found Item(s)" 
                      value={data.garbage.foundItems} 
                      onChange={v => setData(p => ({ ...p, garbage: { ...p.garbage, foundItems: v } }))} 
                      placeholder="e.g. Cutlery, Linen, N/A"
                      condensed
                    />
                    <div className="flex gap-4">
                      <label className="relative w-32 aspect-video bg-white rounded border-2 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer overflow-hidden transition-all flex items-center justify-center">
                        {data.garbage.foundPhoto ? (
                          <img src={data.garbage.foundPhoto} alt="Found" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 gap-1 scale-75">
                            <Camera size={20} />
                            <span className="text-[10px] font-bold">PHOTO</span>
                          </div>
                        )}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleGarbageImageUpload} />
                      </label>
                      <textarea 
                        placeholder="Remarks on found items..."
                        value={data.garbage.foundRemarks}
                        onChange={e => setData(p => ({ ...p, garbage: { ...p.garbage, foundRemarks: e.target.value } }))}
                        className="flex-1 min-h-[64px] p-2 bg-white border border-slate-200 rounded text-sm outline-none focus:border-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {activeSection === 'alarms' && (
            <motion.section 
              key="alarms"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">Alarms Reported</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Input label="Smoke/Heat" value={data.alarms.fireAlarms} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, fireAlarms: v } }))} />
                  <Input label="Gas" value={data.alarms.gasAlarms} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, gasAlarms: v } }))} />
                  <Input label="Panic" value={data.alarms.panicBuzzer} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, panicBuzzer: v } }))} />
                </div>
                <textarea 
                  placeholder="Additional Alarm Details (e.g. Room Nos)"
                  value={data.alarms.alarmDetails}
                  onChange={e => setData(p => ({ ...p, alarms: { ...p.alarms, alarmDetails: e.target.value } }))}
                  className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 text-slate-900"
                />
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">FACP Status</h3>
                <div className="grid grid-cols-4 gap-2">
                  <Input label="ALARM" value={data.alarms.facp.alarm} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, facp: { ...p.alarms.facp, alarm: v } } }))} condensed />
                  <Input label="TROUBLE" value={data.alarms.facp.trouble} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, facp: { ...p.alarms.facp, trouble: v } } }))} condensed />
                  <Input label="SUPERVISORY" value={data.alarms.facp.supervisory} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, facp: { ...p.alarms.facp, supervisory: v } } }))} condensed />
                  <Input label="MONITOR" value={data.alarms.facp.monitors} onChange={v => setData(p => ({ ...p, alarms: { ...p.alarms, facp: { ...p.alarms.facp, monitors: v } } }))} condensed />
                </div>
              </div>
            </motion.section>
          )}

          {activeSection === 'observations' && (
            <motion.section 
              key="observations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Observations</h2>
                <button 
                  onClick={() => addRow('observations')}
                  className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800"
                >
                  <Plus size={16} />
                  Add New
                </button>
              </div>

              <div className="space-y-4">
                {data.observations.map((obs, idx) => (
                  <div key={obs.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden">
                    <button 
                      onClick={() => removeRow('observations', idx)}
                      className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all sm:opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-48 space-y-2">
                        <label className="relative block w-full aspect-video bg-slate-100 rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-300 cursor-pointer overflow-hidden transition-all group-hover:border-blue-200">
                          {obs.photo ? (
                            <img src={obs.photo} alt="Observation" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                              <Camera size={24} />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">16:9 Photo</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            className="hidden" 
                            onChange={e => handleImageUpload(obs.id, e)} 
                          />
                        </label>
                        {obs.photo && (
                          <div className="flex justify-center text-[10px] text-green-600 font-bold items-center gap-1">
                            <CheckCircle2 size={10} />
                            CAPTURED (16:9)
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Input 
                            label="Department" 
                            value={obs.department} 
                            onChange={v => {
                              const next = [...data.observations];
                              next[idx].department = v;
                              setData(p => ({ ...p, observations: next }));
                            }} 
                            placeholder="e.g. ENG, H/K"
                            condensed
                          />
                          <Input 
                            label="Status" 
                            value={obs.status} 
                            onChange={v => {
                              const next = [...data.observations];
                              next[idx].status = v;
                              setData(p => ({ ...p, observations: next }));
                            }} 
                            placeholder="e.g. Fixed, Pending"
                            condensed
                          />
                        </div>
                        <textarea 
                          placeholder="Observation detail / Location description"
                          value={obs.location}
                          onChange={e => {
                            const next = [...data.observations];
                            next[idx].location = e.target.value;
                            setData(p => ({ ...p, observations: next }));
                          }}
                          className="w-full h-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 resize-none text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {data.observations.length === 0 && (
                  <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                    <ImageIcon className="mx-auto text-slate-300 mb-2" size={40} />
                    <p className="text-slate-400 text-sm">No observations recorded yet.</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white py-2 px-4 flex justify-between items-center text-[10px] font-medium z-50">
        <div className="flex items-center gap-2">
          <span>Please contact srinidhi.mp@hilton.com for any assistance</span>
        </div>
        <div className="text-slate-400 uppercase">
          LOGGED AT: {data.metadata.date} {data.metadata.time}
        </div>
      </footer>

      {/* Hidden PDF Canvas Template */}
      <div className="fixed -left-[4000px] top-0 pointer-events-none">
        <div ref={pdfRef} style={{ width: '210mm', backgroundColor: '#ffffff' }}>
          {/* SINGLE CONTINUOUS SHEET */}
          <div className="pdf-report-main" style={{ 
            width: '210mm', 
            minHeight: '297mm',
            padding: '15mm', 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
            backgroundColor: '#ffffff', 
            color: '#000000', 
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            lineHeight: '1.4',
            letterSpacing: '0px',
            fontVariantLigatures: 'none'
          }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.5fr', alignItems: 'center', borderBottom: '2.5px solid #000000', paddingBottom: '16px' }}>
              <div style={{ fontSize: '10px', lineHeight: '1.45' }}>
                <div style={{ margin: '0 0 3px 0' }}><strong>DATE:</strong> {data.metadata.date}</div>
                <div style={{ margin: '0 0 3px 0' }}><strong>TIME:</strong> {data.metadata.time}</div>
                <div style={{ margin: '0 0 3px 0', wordBreak: 'break-all' }}><strong>REPORTED BY:</strong> {data.metadata.reportBy.toUpperCase() || 'NIL'}</div>
                <div style={{ margin: '0', wordBreak: 'break-word' }}><strong>VALUE OF DAY:</strong> {data.metadata.valueOfDay.toUpperCase() || 'NIL'}</div>
              </div>
              <div style={{ textAlign: 'center', alignSelf: 'center' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', margin: '0', padding: '0', color: '#000000', lineHeight: '1.2' }}>DAILY SECURITY REPORT</h1>
              </div>
              <div style={{ textAlign: 'right' }}>
                <img src="https://storage.googleapis.com/test-media-genai/ebb60044-5903-4a31-9243-965178e43d8e/input_file_0.png" alt="Logo" style={{ width: '130px', display: 'inline-block' }} crossOrigin="anonymous" />
              </div>
            </div>

            {/* Shift & System Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>SHIFT PERSONNEL</div>
                <div style={{ padding: '8px', fontSize: '10px', lineHeight: '1.45' }}>
                  <div style={{ margin: '0 0 4px 0' }}><strong>MORNING:</strong> {data.metadata.morningShift.name || 'NIL'} ({data.metadata.morningShift.inCharge || 'NIL'})</div>
                  <div style={{ margin: '0 0 4px 0' }}><strong>AFTERNOON:</strong> {data.metadata.afternoonShift.name || 'NIL'} ({data.metadata.afternoonShift.inCharge || 'NIL'})</div>
                  <div style={{ margin: '0' }}><strong>NIGHT:</strong> {data.metadata.nightShift.name || 'NIL'} ({data.metadata.nightShift.inCharge || 'NIL'})</div>
                </div>
              </div>
              <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>FACP STATUS</div>
                <div style={{ padding: '8px', fontSize: '9.5px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', lineHeight: '1.3' }}>
                  <div><strong>ALARM:</strong> {data.alarms.facp.alarm || '0'}</div>
                  <div><strong>TROUBLE:</strong> {data.alarms.facp.trouble || '0'}</div>
                  <div><strong>SUPERVISORY:</strong> {data.alarms.facp.supervisory || '0'}</div>
                  <div><strong>MONITOR:</strong> {data.alarms.facp.monitors || '0'}</div>
                </div>
              </div>
            </div>

            {/* Security Tasks */}
            <div>
              <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', border: '1.5px solid #000000', borderBottom: '0', borderRadius: '4px 4px 0 0', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>SECURITY TASKS & REMARKS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', fontSize: '9px', lineHeight: '1.35' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: '700' }}>
                    <th style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'left', width: '40%' }}>TASK DESCRIPTION</th>
                    <th style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'left' }}>STATUS / REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.tasks).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ border: '1.5px solid #000000', padding: '6px', fontWeight: '700', textTransform: 'uppercase' }}>{k.replace(/([A-Z])/g, ' $1')}</td>
                      <td style={{ border: '1.5px solid #000000', padding: '6px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                        {typeof v === 'string' ? (v || 'NIL') : (
                          `2W: G-${(v as any).guest2W || 0}, S-${(v as any).staff2W || 0} | 4W: G-${(v as any).guest4W || 0}, S-${(v as any).staff4W || 0}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Transport Logs (Conditional) */}
            {data.pickUpDown.length > 0 && (
              <div>
                <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', border: '1.5px solid #000000', borderBottom: '0', borderRadius: '4px 4px 0 0', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>PICK UP - DROP (TRANSPORT LOGS)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', fontSize: '8.5px', lineHeight: '1.35' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr style={{ textAlign: 'center', fontWeight: '700' }}>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', width: '60px' }}>TIME</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', width: '110px' }}>STRENGTH (M/F)</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px' }}>CHAUFFEUR / VEHICLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pickUpDown.map((item, idx) => (
                      <tr key={idx} style={{ textAlign: 'center' }}>
                        <td style={{ border: '1.5px solid #000000', padding: '6px' }}>{item.time || 'NIL'}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px' }}>MALE: {item.maleStaff || 0} / FEMALE: {item.femaleStaff || 0}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{item.chauffeur} | {item.vehicle}</td>
                      </tr>
                    ))}
                    {/* Summary Totals Row */}
                    <tr style={{ textAlign: 'center', backgroundColor: '#f1f5f9', fontWeight: '800' }}>
                      <td style={{ border: '1.5px solid #000000', padding: '6px' }}>TOTAL TRIPS: {data.pickUpDown.length}</td>
                      <td style={{ border: '1.5px solid #000000', padding: '6px' }}>
                        MALE: {data.pickUpDown.reduce((s, c) => s + (parseInt(c.maleStaff) || 0), 0)} / 
                        FEMALE: {data.pickUpDown.reduce((s, c) => s + (parseInt(c.femaleStaff) || 0), 0)}
                      </td>
                      <td style={{ border: '1.5px solid #000000', padding: '6px' }}>
                        TOTAL TEAM MEMBERS: {data.pickUpDown.reduce((s, c) => s + (parseInt(c.maleStaff) || 0) + (parseInt(c.femaleStaff) || 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Garbage Weights Grid */}
            <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>GARBAGE CLEARANCE SUMMARY</div>
              <div style={{ padding: '10px', fontSize: '9.5px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', textAlign: 'center', lineHeight: '1.3' }}>
                <div><strong>TIME:</strong><div style={{ marginTop: '2px' }}>{data.garbage.time || 'NIL'}</div></div>
                <div><strong>VEHICLE:</strong><div style={{ marginTop: '2px', wordBreak: 'break-all' }}>{data.garbage.vehicleNo || 'NIL'}</div></div>
                <div><strong>DRY:</strong><div style={{ marginTop: '2px' }}>{data.garbage.dryWeight || 0} KG</div></div>
                <div><strong>WET:</strong><div style={{ marginTop: '2px' }}>{data.garbage.wetWeight || 0} KG</div></div>
                <div><strong>CARTOONS:</strong><div style={{ marginTop: '2px' }}>{data.garbage.cartoonWeight || 0} KG</div></div>
                <div style={{ wordBreak: 'break-word' }}><strong>FOUND ITEMS:</strong><div style={{ marginTop: '2px' }}>{data.garbage.foundItems || 'NIL'}</div></div>
              </div>
            </div>

            {/* Garbage Findings (Conditional) - Photo reduced to 45mm */}
            {data.garbage.foundItems && data.garbage.foundItems.toUpperCase() !== 'NIL' && (
              <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>GARBAGE CLEARANCE - ITEMS FOUND</div>
                <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '45mm 1fr', gap: '15px' }}>
                  <div style={{ textAlign: 'center' }}>
                    {data.garbage.foundPhoto ? (
                      <img src={data.garbage.foundPhoto} alt="Found Item" style={{ width: '45mm', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    ) : (
                      <div style={{ width: '45mm', height: '25mm', border: '1.5px dashed #000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#000000' }}>NO PHOTO</div>
                    )}
                  </div>
                  <div style={{ lineHeight: '1.45' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#000000', margin: '0 0 3px 0' }}>ITEMS DESCRIPTION:</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#000000', margin: '0 0 8px 0', wordBreak: 'break-word' }}>{data.garbage.foundItems}</div>
                    {data.garbage.foundRemarks && (
                      <>
                        <div style={{ fontSize: '9px', fontWeight: '800', color: '#000000', margin: '0 0 3px 0' }}>REMARKS:</div>
                        <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#000000', margin: '0', wordBreak: 'break-word' }}>{data.garbage.foundRemarks}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Key Discrepancy (Conditional) */}
            {data.keyDiscrepancies.length > 0 && (
              <div>
                <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', border: '1.5px solid #000000', borderBottom: '0', borderRadius: '4px 4px 0 0', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>KEY DISCREPANCY REPORT</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', fontSize: '8.5px', lineHeight: '1.35' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr style={{ textAlign: 'center', fontWeight: '700' }}>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', width: '30px' }}>SL</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', width: '60px' }}>KEY NO</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px' }}>LOCATION</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px' }}>DEPT</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px' }}>ISSUER</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', width: '100px' }}>DATE/TIME</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', width: '80px' }}>CONTACT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keyDiscrepancies.map((kd, idx) => (
                      <tr key={idx} style={{ textAlign: 'center' }}>
                        <td style={{ border: '1.5px solid #000000', padding: '6px' }}>{idx + 1}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', wordBreak: 'break-all' }}>{kd.keyNo}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{kd.doorName}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', wordBreak: 'break-word' }}>{kd.department}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px' }}>{kd.issuer}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px' }}>{kd.date} {kd.time}</td>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', wordBreak: 'break-all' }}>{kd.contact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* System Status & Open Doors (Conditional) */}
            {(data.gadgetStatus.length > 0 || data.openDoors.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: data.gadgetStatus.length > 0 && data.openDoors.length > 0 ? '1fr 1fr' : '1fr', gap: '16px' }}>
                {data.gadgetStatus.length > 0 && (
                  <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>GADGET / SYSTEM STATUS</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', lineHeight: '1.35' }}>
                      <tbody>
                        {data.gadgetStatus.map((g, i) => (
                          <tr key={i}>
                            <td style={{ borderBottom: '1.5px solid #e2e8f0', padding: '5px 8px', fontWeight: '700', width: '45%' }}>{g.gadget.toUpperCase()}</td>
                            <td style={{ borderBottom: '1.5px solid #e2e8f0', padding: '5px 8px', color: '#000000', wordBreak: 'break-word' }}>{g.remark || 'NIL'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data.openDoors.length > 0 && (
                  <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>OPEN DOORS IN STORES</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', lineHeight: '1.3' }}>
                      <thead style={{ backgroundColor: '#f8fafc' }}>
                        <tr>
                          <th style={{ borderBottom: '1.5px solid #000000', padding: '5px', textAlign: 'left', paddingLeft: '8px' }}>ROOM/AREA</th>
                          <th style={{ borderBottom: '1.5px solid #000000', padding: '5px', textAlign: 'left' }}>STATUS/REMARK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.openDoors.map((door, i) => (
                          <tr key={i}>
                            <td style={{ borderBottom: '1.5px solid #e2e8f0', padding: '5px 8px', fontWeight: '700', wordBreak: 'break-word' }}>{door.room}</td>
                            <td style={{ borderBottom: '1px solid #e2e8f0', padding: '5px 8px', wordBreak: 'break-word' }}>{door.status} - {door.remark}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Alarms Detail */}
            <div style={{ border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #000000', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>ALARMS & SYSTEM SUMMARY</div>
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', borderRadius: '4px' }}>
                    <span style={{ fontSize: '8px', color: '#000000', display: 'block', fontWeight: '700', marginBottom: '3px' }}>SMOKE/HEAT</span>
                    <span style={{ fontSize: '14px', fontWeight: '800' }}>{data.alarms.fireAlarms || '0'}</span>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', borderRadius: '4px' }}>
                    <span style={{ fontSize: '8px', color: '#000000', display: 'block', fontWeight: '700', marginBottom: '3px' }}>GAS ALARM</span>
                    <span style={{ fontSize: '14px', fontWeight: '800' }}>{data.alarms.gasAlarms || '0'}</span>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', borderRadius: '4px' }}>
                    <span style={{ fontSize: '8px', color: '#000000', display: 'block', fontWeight: '700', marginBottom: '3px' }}>PANIC BUZZER</span>
                    <span style={{ fontSize: '14px', fontWeight: '800' }}>{data.alarms.panicBuzzer || '0'}</span>
                  </div>
                </div>
                {data.alarms.alarmDetails && (
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#000000', marginBottom: '2px' }}>DETAILED LOGS:</div>
                    <div style={{ fontSize: '10px', color: '#000000', lineHeight: '1.35', wordBreak: 'break-word' }}>{data.alarms.alarmDetails}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Observations (Conditional) */}
            {data.observations.length > 0 && (
              <div>
                <div style={{ fontWeight: '700', padding: '6px', backgroundColor: '#f1f5f9', border: '1.5px solid #000000', borderBottom: '0', borderRadius: '4px 4px 0 0', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>SECURITY OBSERVATIONS</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', fontSize: '9px', lineHeight: '1.4' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr style={{ fontWeight: '700', textAlign: 'center' }}>
                      <th style={{ border: '1.5px solid #000000', padding: '8px', width: '40mm' }}>PHOTO</th>
                      <th style={{ border: '1.5px solid #000000', padding: '8px' }}>LOCATION & REMARKS</th>
                      <th style={{ border: '1.5px solid #000000', padding: '8px', width: '25mm' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.observations.map((obs) => (
                      <tr key={obs.id}>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {obs.photo ? (
                            <img src={obs.photo} alt="Obs" style={{ width: '38mm', display: 'block', margin: '0 auto', borderRadius: '4px' }} />
                          ) : (
                            <div style={{ fontSize: '8px', color: '#64748b', textAlign: 'center' }}>NO PHOTO</div>
                          )}
                        </td>
                        <td style={{ border: '1.5px solid #000000', padding: '10px', verticalAlign: 'top', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '800', color: '#000000', fontSize: '10px', margin: '0 0 5px 0' }}>DEPT: {obs.department.toUpperCase() || 'NIL'}</div>
                          <div style={{ fontSize: '9.5px', color: '#000000', lineHeight: '1.35', wordBreak: 'break-word', whiteSpace: 'normal' }}>{obs.location || 'NIL'}</div>
                        </td>
                        <td style={{ border: '1.5px solid #000000', padding: '10px', textAlign: 'center', fontWeight: '800', color: '#000000', verticalAlign: 'middle' }}>{obs.status.toUpperCase() || 'PENDING'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function Input({ label, value, onChange, type = "text", placeholder = "", condensed = false }: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  type?: string;
  placeholder?: string;
  condensed?: boolean;
}) {
  return (
    <div className={cn("space-y-1", condensed && "space-y-0.5")}>
      <label className={cn("block text-[10px] font-bold text-slate-500 uppercase tracking-tight", condensed && "text-[9px]")}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-slate-400 transition-all focus:ring-1 focus:ring-slate-100 text-slate-900",
          condensed && "p-1.5 text-xs"
        )}
      />
    </div>
  );
}

function ShiftInput({ label, info, onChange }: { 
  label: string; 
  info: ShiftInfo; 
  onChange: (field: string, val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
      <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <input 
          placeholder="Role" 
          value={info.inCharge || ''}
          onChange={e => onChange('inCharge', e.target.value)}
          className="bg-white border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-slate-400 text-slate-900"
        />
        <input 
          placeholder="Name" 
          value={info.name || ''}
          onChange={e => onChange('name', e.target.value)}
          className="bg-white border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-slate-400 text-slate-900"
        />
      </div>
    </div>
  );
}

function TaskItem({ label, value, onChange }: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1 pb-2 border-b border-slate-100 last:border-0">
      <div className="flex justify-between items-start gap-2">
        <label className="text-xs font-bold text-slate-700 leading-tight pt-1">{label}</label>
        <div className="flex items-center gap-1">
          {value ? <CheckCircle2 size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-slate-200" />}
        </div>
      </div>
      <input 
        placeholder="Enter Remark / NIL" 
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-100 rounded p-1.5 text-xs outline-none focus:border-slate-300 transition-all text-slate-900"
      />
    </div>
  );
}
