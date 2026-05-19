import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home as HomeIcon,
  Dumbbell,
  UtensilsCrossed,
  TrendingUp,
  Plus,
  User,
  Minus,
  Sparkles,
  Trophy,
  Star,
  Loader2,
  Check,
  X,
  Droplet,
  RotateCcw,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

// ---------- shared types & data ----------
type Phase = "Bulk" | "Lean Bulk" | "Cut";
type Meal = { id: string; name: string; kcal: number; protein: number; carbs: number; fat?: number; time: string };
type Targets = { kcal: number; protein: number; carbs: number; fat: number; water: number };

// Multipliers per kg of bodyweight. AI recommendations scale with the user's weight.
const PHASE_MULTIPLIERS: Record<Phase, { kcal: number; protein: number; carbs: number; fat: number }> = {
  Bulk:       { kcal: 38, protein: 2.2, carbs: 4.5, fat: 1.1 },
  "Lean Bulk":{ kcal: 33, protein: 2.2, carbs: 3.5, fat: 1.0 },
  Cut:        { kcal: 26, protein: 2.4, carbs: 2.5, fat: 0.8 },
};

const PHASE_META: Record<Phase, { confidence: number; explain: (w: number, t: Targets) => string }> = {
  Bulk: {
    confidence: 74,
    explain: (w, t) =>
      `At ${w}kg, a Bulk surplus targets ${t.kcal} kcal/day (~38 kcal/kg). Expect +0.4-0.6kg/week. Hit ${t.protein}g protein to drive muscle synthesis.`,
  },
  "Lean Bulk": {
    confidence: 87,
    explain: (w, t) =>
      `At ${w}kg, a Lean Bulk holds you at ${t.kcal} kcal/day (~33 kcal/kg) — enough surplus for strength gains while keeping fat gain minimal (~0.2kg/week).`,
  },
  Cut: {
    confidence: 91,
    explain: (w, t) =>
      `At ${w}kg, a Cut deficit of ${t.kcal} kcal/day (~26 kcal/kg) drops ~0.5kg/week. High protein (${t.protein}g) preserves the muscle you've built.`,
  },
};

function computeTargets(weight: number, phase: Phase): Targets {
  const m = PHASE_MULTIPLIERS[phase];
  return {
    kcal: Math.round((weight * m.kcal) / 10) * 10,
    protein: Math.round(weight * m.protein),
    carbs: Math.round(weight * m.carbs),
    fat: Math.round(weight * m.fat),
    water: Math.max(2, Math.round((weight * 0.035) * 10) / 10), // L/day
  };
}

// ---------- CountUp ----------
function CountUp({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const to = value;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

// ---------- Phone frame ----------
export default function MealMateApp() {
  const [tab, setTab] = useState<0 | 1 | 2 | 3>(0);
  const [phase, setPhase] = useState<Phase>("Cut");
  const [weight, setWeight] = useState<number | null>(null); // kg
  const [profileOpen, setProfileOpen] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([
    { id: "m1", name: "Greek Yogurt Bowl", kcal: 320, protein: 28, carbs: 35, time: "8:15 AM" },
    { id: "m2", name: "Chicken & Rice", kcal: 520, protein: 45, carbs: 60, time: "12:40 PM" },
  ]);
  const [water, setWater] = useState(1.4); // L consumed today

  // Open onboarding if user hasn't set weight yet
  useEffect(() => {
    if (weight === null) {
      const t = setTimeout(() => setProfileOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [weight]);

  const effectiveWeight = weight ?? 75;
  const targets = computeTargets(effectiveWeight, phase);
  const consumed = meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
    }),
    { kcal: 0, protein: 0, carbs: 0 },
  );

  const addMeal = (m: Omit<Meal, "id" | "time">) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMeals((prev) => [...prev, { ...m, id: crypto.randomUUID(), time }]);
  };

  const adjustWater = (delta: number) =>
    setWater((w) => Math.max(0, Math.min(targets.water + 1, +(w + delta).toFixed(2))));

  const screens = [
    <HomeScreen key="home" phase={phase} targets={targets} consumed={consumed} meals={meals} water={water} adjustWater={adjustWater} resetWater={() => setWater(0)} addMeal={addMeal} weight={weight} openProfile={() => setProfileOpen(true)} />,
    <GymScreen key="gym" weight={effectiveWeight} phase={phase} />,
    <MealsScreen key="meals" phase={phase} targets={targets} weight={effectiveWeight} addMeal={addMeal} />,
    <AdvisorScreen key="adv" phase={phase} setPhase={setPhase} weight={effectiveWeight} targets={targets} />,
  ];

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 font-dm"
      style={{ background: "linear-gradient(140deg, #0f6e56 0%, #1D9E75 100%)" }}
    >
      <div
        className="relative bg-black"
        style={{ width: 393, height: 852, borderRadius: 56, padding: 12, boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}
      >
        <div
          className="relative overflow-hidden bg-white"
          style={{ width: "100%", height: "100%", borderRadius: 44 }}
        >
          {/* notch */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-30 bg-black"
            style={{ top: 10, width: 120, height: 32, borderRadius: 20 }}
          />
          {/* status bar spacer */}
          <div style={{ height: 54 }} />

          {/* screen content */}
          <div className="relative" style={{ height: 852 - 24 - 54 - 78 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 20 }}
              >
                {screens[tab]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* bottom nav */}
          <BottomNav tab={tab} setTab={setTab} />

          <ProfileSheet
            open={profileOpen}
            onOpenChange={setProfileOpen}
            weight={weight}
            setWeight={setWeight}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Bottom Nav ----------
function BottomNav({ tab, setTab }: { tab: number; setTab: (n: 0 | 1 | 2 | 3) => void }) {
  const items = [
    { icon: HomeIcon, label: "Home" },
    { icon: Dumbbell, label: "Gym" },
    { icon: UtensilsCrossed, label: "Meals" },
    { icon: TrendingUp, label: "Progress" },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t" style={{ borderColor: "var(--mm-border)", height: 78 }}>
      <div className="flex h-full">
        {items.map((it, i) => {
          const active = tab === i;
          const Icon = it.icon;
          return (
            <button
              key={it.label}
              onClick={() => setTab(i as 0 | 1 | 2 | 3)}
              className="flex-1 relative flex flex-col items-center justify-center gap-1"
              style={{ color: active ? "var(--mm-primary)" : "var(--mm-muted)" }}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] font-semibold">{it.label}</span>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute"
                  style={{ bottom: 10, width: 6, height: 6, borderRadius: 999, background: "var(--mm-primary)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- card helpers ----------
const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--mm-border)",
  borderRadius: 20,
  padding: 18,
  boxShadow: "none",
};

function StaggerCard({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      style={{ ...cardStyle, ...style }}
    >
      {children}
    </motion.div>
  );
}

// ---------- SCREEN 1: HOME ----------
function HomeScreen({
  phase, targets, consumed, meals, water, adjustWater, resetWater, addMeal, weight, openProfile,
}: {
  phase: Phase;
  targets: Targets;
  consumed: { kcal: number; protein: number; carbs: number };
  meals: Meal[];
  water: number;
  adjustWater: (delta: number) => void;
  resetWater: () => void;
  addMeal: (m: Omit<Meal, "id" | "time">) => void;
  weight: number | null;
  openProfile: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ name: "", kcal: "", protein: "", carbs: "" });

  const remaining = Math.max(0, targets.kcal - consumed.kcal);
  const pct = Math.min(100, (consumed.kcal / targets.kcal) * 100);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold text-black leading-none">MealMate</h1>
          <p className="text-[14px] text-gray-500 mt-1">{today}</p>
        </div>
        <button
          onClick={openProfile}
          className="rounded-full flex items-center justify-center"
          style={{ width: 42, height: 42, background: "var(--mm-primary-light)" }}
        >
          <User size={20} style={{ color: "var(--mm-primary)" }} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <motion.div
          key={phase}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
          style={{ background: "var(--mm-primary-light)", color: "var(--mm-primary-dark)" }}
        >
          <Sparkles size={12} /> {phase} Phase
        </motion.div>
        <button
          onClick={openProfile}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border"
          style={{ borderColor: "var(--mm-border)", color: "#374151" }}
        >
          {weight ? `${weight} kg` : "Set weight"}
        </button>
      </div>

      <StaggerCard delay={0.05}>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Today's Calories</p>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-[46px] font-extrabold leading-none">
            <CountUp value={consumed.kcal} />
          </span>
          <span className="text-gray-400 font-semibold">/ {targets.kcal.toLocaleString()} kcal</span>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--mm-border)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, type: "spring", stiffness: 80, damping: 18 }}
            style={{ height: "100%", background: "var(--mm-primary)" }}
          />
        </div>
        <p className="text-[13px] text-gray-500 mt-2 font-semibold">{remaining.toLocaleString()} kcal remaining</p>
      </StaggerCard>

      <div className="grid grid-cols-2 gap-3">
        <MacroTile label="Protein" value={consumed.protein} target={targets.protein} unit="g" delay={0.1} />
        <MacroTile label="Carbs" value={consumed.carbs} target={targets.carbs} unit="g" delay={0.15} />
      </div>

      <WaterCard water={water} target={targets.water} adjustWater={adjustWater} resetWater={resetWater} />


      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        onClick={() => setSheet(true)}
        className="w-full flex items-center justify-center gap-2 text-white font-extrabold"
        style={{ background: "var(--mm-primary)", borderRadius: 28, padding: "16px 20px", fontSize: 16 }}
      >
        <Plus size={20} strokeWidth={2.8} /> Log Meal
      </motion.button>

      <div>
        <h2 className="text-[18px] font-extrabold mt-2 mb-2">Recent Meals</h2>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {[...meals].reverse().map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="flex items-center justify-between"
                style={{ ...cardStyle, padding: 14 }}
              >
                <div>
                  <p className="font-bold text-[15px]">{m.name}</p>
                  <p className="text-[12px] text-gray-400">{m.time}</p>
                </div>
                <p className="font-extrabold text-[15px]" style={{ color: "var(--mm-primary)" }}>
                  {m.kcal} kcal
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl font-dm">
          <div className="mx-auto mb-3 mt-1 h-1.5 w-12 rounded-full bg-gray-200" />
          <SheetHeader>
            <SheetTitle className="text-[20px] font-extrabold text-left">Log a Meal</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <Input placeholder="Meal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Calories" inputMode="numeric" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
              <Input placeholder="Protein g" inputMode="numeric" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
              <Input placeholder="Carbs g" inputMode="numeric" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!form.name || !form.kcal) return;
                addMeal({
                  name: form.name,
                  kcal: Number(form.kcal) || 0,
                  protein: Number(form.protein) || 0,
                  carbs: Number(form.carbs) || 0,
                });
                setForm({ name: "", kcal: "", protein: "", carbs: "" });
                setSheet(false);
              }}
              className="w-full text-white font-extrabold"
              style={{ background: "var(--mm-primary)", borderRadius: 28, padding: "14px 20px" }}
            >
              Add Meal
            </motion.button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MacroTile({
  label, value, target, unit, delay = 0, onTap,
}: { label: string; value: number; target: number; unit: string; delay?: number; onTap?: () => void }) {
  const pct = Math.min(100, (value / target) * 100);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      onClick={onTap}
      style={{ ...cardStyle, padding: 14, textAlign: "left" }}
    >
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</p>
      <p className="text-[22px] font-extrabold mt-1 leading-none">
        {unit === "L" ? value.toFixed(1) : Math.round(value)}
        <span className="text-[12px] text-gray-400 font-bold ml-1">/{target}{unit}</span>
      </p>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--mm-border)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, type: "spring", stiffness: 90, damping: 18 }}
          style={{ height: "100%", background: "var(--mm-primary)" }}
        />
      </div>
    </motion.button>
  );
}

// ---------- SCREEN 2: GYM ----------
function GymScreen({ weight, phase }: { weight: number; phase: Phase }) {
  // Weight-aware programming. Bench target = bodyweight * phase coefficient.
  const benchCoef = phase === "Bulk" ? 1.15 : phase === "Lean Bulk" ? 1.05 : 0.95;
  const benchTarget = Math.round(weight * benchCoef / 2.5) * 2.5;
  const ohp = Math.round((weight * 0.6) / 2.5) * 2.5;
  const lat = Math.max(5, Math.round((weight * 0.18) / 0.5) * 0.5);

  const repScheme =
    phase === "Cut"
      ? { sets: 3, reps: 12 } // preserve muscle, higher reps
      : phase === "Lean Bulk"
        ? { sets: 4, reps: 8 }
        : { sets: 5, reps: 6 }; // bulk — heavier

  const [exercises, setExercises] = useState([
    { name: "Bench Press", sets: repScheme.sets, reps: repScheme.reps, weight: benchTarget, unit: "kg" },
    { name: "Overhead Press", sets: 3, reps: repScheme.reps + 2, weight: ohp, unit: "kg" },
    { name: "Tricep Dips", sets: 3, reps: 12, weight: 0, unit: "BW" },
    { name: "Lateral Raise", sets: 4, reps: 15, weight: lat, unit: "kg" },
  ]);

  // Re-sync prescribed loads when weight or phase change
  useEffect(() => {
    setExercises([
      { name: "Bench Press", sets: repScheme.sets, reps: repScheme.reps, weight: benchTarget, unit: "kg" },
      { name: "Overhead Press", sets: 3, reps: repScheme.reps + 2, weight: ohp, unit: "kg" },
      { name: "Tricep Dips", sets: 3, reps: 12, weight: 0, unit: "BW" },
      { name: "Lateral Raise", sets: 4, reps: 15, weight: lat, unit: "kg" },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weight, phase]);

  // 4-week trend scaled around the user's bench target
  const data = [
    { name: "W1", kg: Math.round((benchTarget - 10) * 10) / 10 },
    { name: "W2", kg: Math.round((benchTarget - 5) * 10) / 10 },
    { name: "W3", kg: Math.round((benchTarget - 2.5) * 10) / 10 },
    { name: "W4", kg: benchTarget },
  ];

  const aiTip =
    phase === "Bulk"
      ? `At ${weight}kg in a Bulk, push compounds heavy (${repScheme.sets}×${repScheme.reps}). Add 2.5kg to bench weekly while you can.`
      : phase === "Lean Bulk"
        ? `At ${weight}kg, run ${repScheme.sets}×${repScheme.reps} on big lifts. Add reps before load to chase clean strength gains.`
        : `At ${weight}kg in a Cut, keep loads near ${benchTarget}kg but raise reps to ${repScheme.reps}. Protect strength, don't chase PRs.`;

  const update = (i: number, key: "reps" | "weight", delta: number) =>
    setExercises((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [key]: Math.max(0, (e[key] as number) + delta) } : e)),
    );

  return (
    <div className="space-y-4 pb-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Today · Push Day</p>
      <h1 className="text-[30px] font-extrabold leading-none">{weight}kg · {phase}</h1>

      <div
        style={{ ...cardStyle, borderLeft: "3px solid var(--mm-primary)", padding: 14 }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={12} style={{ color: "var(--mm-primary)" }} />
          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--mm-primary-dark)" }}>
            AI Coach
          </span>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed">{aiTip}</p>
      </div>


      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
        style={{ background: "var(--mm-amber-light)", color: "var(--mm-amber-text)" }}
      >
        <Trophy size={12} /> Bench Press +5kg PB
      </motion.div>

      <StaggerCard delay={0.05}>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">Bench Press · 4-week trend</p>
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#e1f5ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[60, 90]} />
              <Tooltip cursor={false} contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6" }} />
              <Area type="monotone" dataKey="kg" stroke="#1D9E75" strokeWidth={2.5} fill="url(#g1)" dot={{ r: 5, fill: "#1D9E75", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </StaggerCard>

      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-extrabold">Exercises</h2>
        <p className="text-[12px] text-gray-400 font-semibold">{exercises.length} total</p>
      </div>

      <StaggerCard delay={0.1} style={{ padding: 0 }}>
        <div className="grid grid-cols-[1.4fr_0.6fr_1fr_1.2fr] px-4 py-3 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
          <div>Exercise</div><div>Sets</div><div>Reps</div><div>Weight</div>
        </div>
        {exercises.map((e, i) => (
          <div key={e.name} className="grid grid-cols-[1.4fr_0.6fr_1fr_1.2fr] items-center px-4 py-3 border-t" style={{ borderColor: "var(--mm-border)" }}>
            <div className="text-[14px] font-bold pr-2">{e.name}</div>
            <div className="text-[14px] font-semibold">{e.sets}</div>
            <Stepper value={e.reps} onMinus={() => update(i, "reps", -1)} onPlus={() => update(i, "reps", 1)} />
            <Stepper
              value={e.unit === "BW" ? "BW" : `${e.weight}kg`}
              onMinus={() => e.unit !== "BW" && update(i, "weight", -2.5)}
              onPlus={() => e.unit !== "BW" && update(i, "weight", 2.5)}
              disabled={e.unit === "BW"}
            />
          </div>
        ))}
      </StaggerCard>
    </div>
  );
}

function Stepper({ value, onMinus, onPlus, disabled }: { value: number | string; onMinus: () => void; onPlus: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onMinus}
        disabled={disabled}
        className="flex items-center justify-center rounded-full disabled:opacity-30"
        style={{ width: 26, height: 26, background: "var(--mm-primary-light)", color: "var(--mm-primary)" }}
      >
        <Minus size={14} strokeWidth={2.8} />
      </button>
      <motion.span
        key={String(value)}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="text-[13px] font-extrabold w-12 text-center tabular-nums"
      >
        {value}
      </motion.span>
      <button
        onClick={onPlus}
        disabled={disabled}
        className="flex items-center justify-center rounded-full disabled:opacity-30"
        style={{ width: 26, height: 26, background: "var(--mm-primary-light)", color: "var(--mm-primary)" }}
      >
        <Plus size={14} strokeWidth={2.8} />
      </button>
    </div>
  );
}

// ---------- SCREEN 3: MEALS ----------
type Suggestion = { name: string; kcal: number; protein: number; carbs: number; fat: number; description: string };

function MealsScreen({
  phase, targets, addMeal,
}: { phase: Phase; targets: { kcal: number; protein: number; carbs: number; fat: number }; addMeal: (m: Omit<Meal, "id" | "time">) => void }) {
  const [tags, setTags] = useState<string[]>(["Chicken", "Rice", "Eggs"]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [logged, setLogged] = useState<Record<number, boolean>>({});

  const generate = async () => {
    setLoading(true);
    setError(false);
    setLogged({});
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingredients: tags, phase, targets }),
      });
      if (!res.ok) throw new Error("bad");
      const data = (await res.json()) as { meals: Suggestion[] };
      setSuggestions(data.meals);
    } catch {
      setError(true);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-[30px] font-extrabold leading-none">Meal Ideas</h1>
      <p className="text-[14px] text-gray-500">AI-curated for what's in your fridge</p>

      <StaggerCard delay={0.05}>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-3">Your Ingredients</p>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {tags.map((t) => (
              <motion.span
                key={t}
                layout
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold"
                style={{ background: "var(--mm-primary-light)", color: "var(--mm-primary-dark)" }}
              >
                {t}
                <button onClick={() => setTags((p) => p.filter((x) => x !== t))}>
                  <X size={13} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex gap-2 mt-3">
          <Input
            placeholder="Add ingredient..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                setTags((p) => [...p, draft.trim()]);
                setDraft("");
              }
            }}
          />
          <button
            onClick={() => {
              if (!draft.trim()) return;
              setTags((p) => [...p, draft.trim()]);
              setDraft("");
            }}
            className="flex items-center justify-center text-white"
            style={{ width: 44, height: 40, borderRadius: 12, background: "var(--mm-primary)" }}
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
      </StaggerCard>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={generate}
        disabled={loading || tags.length === 0}
        className="w-full flex items-center justify-center gap-2 text-white font-extrabold disabled:opacity-60"
        style={{ background: "var(--mm-primary)", borderRadius: 28, padding: "16px 20px", fontSize: 15 }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Star size={16} />}
        {loading ? "Thinking..." : "Generate Meal Ideas"}
      </motion.button>

      {error && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-[13px] text-red-700 font-semibold">
          Could not generate meals — please try again
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence>
          {suggestions.map((s, i) => (
            <motion.div
              key={s.name + i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold text-[16px]">{s.name}</p>
                <span
                  className="text-[12px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: "var(--mm-primary-light)", color: "var(--mm-primary-dark)" }}
                >
                  {s.kcal} kcal
                </span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1.5">{s.description}</p>
              <p className="text-[12px] text-gray-400 mt-2 font-semibold">
                Protein {s.protein}g · Carbs {s.carbs}g · Fat {s.fat}g
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  if (logged[i]) return;
                  addMeal({ name: s.name, kcal: s.kcal, protein: s.protein, carbs: s.carbs, fat: s.fat });
                  setLogged((p) => ({ ...p, [i]: true }));
                }}
                animate={{
                  background: logged[i] ? "#1D9E75" : "#ffffff",
                  color: logged[i] ? "#ffffff" : "#1D9E75",
                }}
                transition={{ type: "spring", stiffness: 250, damping: 22 }}
                className="mt-3 w-full flex items-center justify-center gap-2 font-extrabold text-[14px]"
                style={{ border: "2px solid #1D9E75", borderRadius: 24, padding: "10px 16px" }}
              >
                {logged[i] ? <Check size={16} strokeWidth={3} /> : null}
                {logged[i] ? "Logged!" : "Log this meal"}
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- SCREEN 4: ADVISOR ----------
function AdvisorScreen({ phase, setPhase }: { phase: Phase; setPhase: (p: Phase) => void }) {
  const d = PHASE_DATA[phase];

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-[26px] font-extrabold leading-tight">AI Phase Advisor</h1>
      <p className="text-[14px] text-gray-500 -mt-2">Coach recommendations based on your trends</p>

      <div
        style={{
          ...cardStyle,
          borderLeft: "3px solid var(--mm-primary)",
          padding: 18,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ background: "var(--mm-primary-light)", color: "var(--mm-primary-dark)" }}
          >
            <Sparkles size={11} /> AI Recommendation
          </span>
          <motion.span
            key={d.confidence}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[14px] font-extrabold"
            style={{ color: "var(--mm-primary)" }}
          >
            {d.confidence}%
          </motion.span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-[32px] font-extrabold mt-3 leading-none">{phase}</p>
            <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">{d.explanation}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">Choose Phase</p>
        <div className="grid grid-cols-3 gap-2">
          {(["Bulk", "Lean Bulk", "Cut"] as Phase[]).map((p) => {
            const active = p === phase;
            return (
              <motion.button
                key={p}
                onClick={() => setPhase(p)}
                animate={{
                  background: active ? "#1D9E75" : "#ffffff",
                  color: active ? "#ffffff" : "#374151",
                }}
                transition={{ duration: 0.2 }}
                className="font-extrabold text-[13px]"
                style={{
                  border: active ? "1px solid #1D9E75" : "1px solid #e5e7eb",
                  borderRadius: 24,
                  padding: "11px 8px",
                }}
              >
                {p}
              </motion.button>
            );
          })}
        </div>
      </div>

      <StaggerCard delay={0.05}>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Adjusted Daily Target</p>
        <p className="text-[40px] font-extrabold leading-none mt-2">
          <CountUp value={d.kcal} />
          <span className="text-[16px] text-gray-400 font-bold ml-1">kcal/day</span>
        </p>
        <p className="text-[13px] text-gray-500 mt-3 font-semibold">
          Protein: {d.protein}g · Carbs: {d.carbs}g · Fat: {d.fat}g
        </p>
      </StaggerCard>
    </div>
  );
}
