import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Area, AreaChart, LineChart, Line
} from "recharts";

const API = "https://lifelens-1.onrender.com";

const CHART_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#EF4444", "#14B8A6",
];

// ─── THEME SYSTEM ─────────────────────────────────────────────────────────────
const themes = {
  dark: {
    bg: "linear-gradient(135deg, #020817 0%, #0F172A 35%, #1a1040 65%, #0c1930 100%)",
    surface: "rgba(255,255,255,0.04)",
    surfaceHover: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.08)",
    text: "#E2E8F0",
    textMuted: "#94A3B8",
    textFaint: "#64748B",
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "rgba(255,255,255,0.08)",
      shadow: "0 8px 32px rgba(0,0,0,0.2)",
    },
    input: {
      background: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.1)",
      color: "#E2E8F0",
    },
  },
  light: {
    bg: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 35%, #FAF5FF 65%, #EFF6FF 100%)",
    surface: "rgba(99,102,241,0.05)",
    surfaceHover: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.15)",
    text: "#1E1B4B",
    textMuted: "#4C1D95",
    textFaint: "#6D28D9",
    card: {
      background: "rgba(255,255,255,0.7)",
      border: "rgba(99,102,241,0.15)",
      shadow: "0 8px 32px rgba(99,102,241,0.1)",
    },
    input: {
      background: "rgba(255,255,255,0.8)",
      border: "rgba(99,102,241,0.2)",
      color: "#1E1B4B",
    },
  },
};

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("authToken");
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "rgba(15,23,42,0.95)", border: "1px solid rgba(99,102,241,0.4)",
        borderRadius: "12px", padding: "10px 16px", color: "white",
        fontSize: "13px", backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#A5B4FC" }}>{label || payload[0].name}</p>
        <p style={{ margin: "4px 0 0", color: "#E2E8F0" }}>{payload[0].value} hrs</p>
      </div>
    );
  }
  return null;
};

// ─── POMODORO TIMER ───────────────────────────────────────────────────────────
function PomodoroTimer({ theme: t }) {
  const [mode, setMode] = useState("work"); // work | short | long
  const [durations] = useState({ work: 25, short: 5, long: 15 });
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [category, setCategory] = useState("focus");
  const intervalRef = useRef(null);

  const totalSeconds = durations[mode] * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  const switchMode = (m) => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setMode(m);
    setTimeLeft(durations[m] * 60);
  };

  const startTimer = async () => {
    try {
      const r = await axios.post(`${API}/pomodoro/start`,
        { duration: durations[mode], category },
        { headers: authHeaders() }
      );
      setSessionId(r.data.session_id);
    } catch (e) { console.error(e); }
    setRunning(true);
  };

  const pauseTimer = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setTimeLeft(durations[mode] * 60);
    setSessionId(null);
  };

  const completeSession = useCallback(async () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setCompletedSessions(s => s + 1);
    if (sessionId) {
      try {
        await axios.put(`${API}/pomodoro/${sessionId}/complete`, {}, { headers: authHeaders() });
      } catch (e) { console.error(e); }
    }
    setTimeLeft(durations[mode] * 60);
    setSessionId(null);
    // Play a subtle beep via AudioContext
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; gain.gain.value = 0.15;
      osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  }, [sessionId, mode, durations]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { completeSession(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, completeSession]);

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (progress / 100) * circumference;

  const modeColors = { work: "#6366F1", short: "#10B981", long: "#F59E0B" };
  const color = modeColors[mode];

  return (
    <div style={{ ...glassCard(t), marginBottom: "28px" }}>
      <h2 style={sectionHeading(t)}>🔥 FocusFire</h2>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px", justifyContent: "center" }}>
        {[["work", "Work", "25m"], ["short", "Short Break", "5m"], ["long", "Long Break", "15m"]].map(([m, label, dur]) => (
          <button key={m} onClick={() => switchMode(m)} style={{
            padding: "8px 16px", borderRadius: "10px", border: "none", cursor: "pointer",
            fontSize: "0.82rem", fontWeight: 600,
            background: mode === m ? modeColors[m] : t.surface,
            color: mode === m ? "white" : t.textMuted,
            transition: "all 0.2s",
          }}>
            {label} <span style={{ opacity: 0.7 }}>({dur})</span>
          </button>
        ))}
      </div>

      {/* Circular progress */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "28px" }}>
        <div style={{ position: "relative", width: "160px", height: "160px" }}>
          <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="80" cy="80" r="54" fill="none" stroke={t.border} strokeWidth="8" />
            <circle cx="80" cy="80" r="54" fill="none" stroke={color}
              strokeWidth="8" strokeDasharray={circumference}
              strokeDashoffset={dashOffset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: "2.4rem", fontWeight: "800", color: t.text, letterSpacing: "-2px", fontVariantNumeric: "tabular-nums" }}>
              {mins}:{secs}
            </div>
            <div style={{ fontSize: "0.72rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "2px" }}>
              {mode === "work" ? "Focus" : mode === "short" ? "Break" : "Long Break"}
            </div>
          </div>
        </div>

        {/* Sessions indicator */}
        <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: "10px", height: "10px", borderRadius: "50%",
              background: i < (completedSessions % 4) ? color : t.surface,
              border: `1px solid ${color}55`,
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        <div style={{ fontSize: "0.78rem", color: t.textFaint, marginTop: "8px" }}>
          {completedSessions} sessions completed today
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom: "16px" }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{
          width: "100%", padding: "10px 14px", borderRadius: "10px",
          border: `1px solid ${t.border}`, background: t.input.background,
          color: t.text, fontSize: "0.88rem", cursor: "pointer", outline: "none",
        }}>
          {["focus", "study", "work", "reading", "exercise", "creative"].map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px" }}>
        {!running ? (
          <button onClick={startTimer} style={{
            flex: 1, padding: "13px", borderRadius: "12px", border: "none",
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
            boxShadow: `0 8px 24px ${color}44`,
          }}>▶ Start</button>
        ) : (
          <button onClick={pauseTimer} style={{
            flex: 1, padding: "13px", borderRadius: "12px", border: "none",
            background: "linear-gradient(135deg, #F59E0B, #EF4444)",
            color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
          }}>⏸ Pause</button>
        )}
        <button onClick={resetTimer} style={{
          padding: "13px 18px", borderRadius: "12px", cursor: "pointer",
          background: t.surface, border: `1px solid ${t.border}`,
          color: t.textMuted, fontWeight: 600, fontSize: "0.9rem",
        }}>↺ Reset</button>
      </div>
    </div>
  );
}

// ─── GOALS PAGE ───────────────────────────────────────────────────────────────
function GoalsPage({ theme: t }) {
  const [goals, setGoals] = useState([]);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState("other");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchGoals = async () => {
    try {
      const r = await axios.get(`${API}/goals`, { headers: authHeaders() });
      setGoals(r.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchGoals(); }, []);

  const addGoal = async () => {
    if (!title.trim() || !target) return alert("Please fill all required fields");
    setLoading(true);
    try {
      await axios.post(`${API}/goals`,
        { title: title.trim(), target: parseFloat(target), category, deadline },
        { headers: authHeaders() }
      );
      setTitle(""); setTarget(""); setDeadline(""); setCategory("other");
      fetchGoals();
    } catch (e) { alert("Failed to create goal"); }
    setLoading(false);
  };

  const progressPct = (goal) => Math.min(100, Math.round((goal.progress / goal.target) * 100));

  return (
    <div>
      {/* Create goal form */}
      <div style={{ ...glassCard(t), marginBottom: "24px" }}>
        <h2 style={sectionHeading(t)}>🎯 Create Goal</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <input placeholder="Goal title" value={title} onChange={e => setTitle(e.target.value)}
            style={inputStyle(t)} />
          <input type="number" placeholder="Target hours" value={target} onChange={e => setTarget(e.target.value)}
            style={inputStyle(t)} />
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ ...inputStyle(t), cursor: "pointer" }}>
            {["study", "work", "fitness", "reading", "creative", "other"].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <input type="date" placeholder="Deadline (optional)" value={deadline}
            onChange={e => setDeadline(e.target.value)} style={inputStyle(t)} />
        </div>
        <button onClick={addGoal} disabled={loading}
          style={{ ...primaryBtn, width: "100%", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Creating…" : "Create Goal"}
        </button>
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <div style={{ ...glassCard(t), textAlign: "center", padding: "48px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎯</div>
          <h3 style={{ color: t.text, margin: "0 0 8px" }}>No goals yet</h3>
          <p style={{ color: t.textMuted, margin: 0 }}>Create your first goal above to start tracking!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {goals.map((goal, idx) => (
            <div key={goal._id} style={{
              ...glassCard(t), padding: "20px",
              borderLeft: `4px solid ${CHART_COLORS[idx % CHART_COLORS.length]}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontWeight: 700, color: t.text, fontSize: "1rem" }}>{goal.title}</div>
                  <div style={{ color: t.textMuted, fontSize: "0.8rem", marginTop: "3px" }}>
                    {goal.category} · {goal.progress} / {goal.target} hrs
                    {goal.deadline && ` · Due ${goal.deadline}`}
                  </div>
                </div>
                <div style={{
                  background: goal.completed ? "rgba(16,185,129,0.15)" : t.surface,
                  color: goal.completed ? "#4ADE80" : t.textMuted,
                  border: `1px solid ${goal.completed ? "rgba(16,185,129,0.3)" : t.border}`,
                  borderRadius: "8px", padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600,
                }}>
                  {goal.completed ? "✓ Done" : `${progressPct(goal)}%`}
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: "6px", borderRadius: "3px", background: t.surface, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: "3px",
                  width: `${progressPct(goal)}%`,
                  background: `linear-gradient(90deg, ${CHART_COLORS[idx % CHART_COLORS.length]}, ${CHART_COLORS[(idx + 2) % CHART_COLORS.length]})`,
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────
function CalendarView({ theme: t }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calData, setCalData] = useState({});
  const [selected, setSelected] = useState(null);

  const fetchCalendar = async () => {
    try {
      const r = await axios.get(`${API}/calendar/${year}/${month}`, { headers: authHeaders() });
      setCalData(r.data.activities || {});
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchCalendar(); }, [year, month]);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const today = now.getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const dayActivities = selected ? (calData[String(selected).padStart(2, "0")] || calData[String(selected)] || []) : [];

  return (
    <div style={{ ...glassCard(t) }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={prevMonth} style={navBtn(t)}>←</button>
        <h2 style={{ color: t.text, fontWeight: 800, fontSize: "1.2rem", margin: 0 }}>
          {monthNames[month - 1]} {year}
        </h2>
        <button onClick={nextMonth} style={navBtn(t)}>→</button>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} style={{ textAlign: "center", color: t.textFaint, fontSize: "0.75rem", fontWeight: 700, padding: "6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const dayKey = String(day).padStart(2, "0");
          const hasActivity = calData[dayKey] && calData[dayKey].length > 0;
          const isToday = isCurrentMonth && day === today;
          const isSelected = selected === day;

          return (
            <div key={day} onClick={() => setSelected(isSelected ? null : day)} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", borderRadius: "10px",
              cursor: "pointer", position: "relative",
              background: isSelected ? "rgba(99,102,241,0.3)" : isToday ? "rgba(99,102,241,0.15)" : t.surface,
              border: `1px solid ${isSelected ? "#6366F1" : isToday ? "rgba(99,102,241,0.4)" : t.border}`,
              transition: "all 0.15s",
              fontWeight: isToday ? 800 : 500,
              color: isToday ? "#818CF8" : t.text,
              fontSize: "0.88rem",
            }}>
              {day}
              {hasActivity && (
                <div style={{
                  position: "absolute", bottom: "5px",
                  display: "flex", gap: "2px",
                }}>
                  {(calData[dayKey] || []).slice(0, 3).map((_, ai) => (
                    <div key={ai} style={{
                      width: "4px", height: "4px", borderRadius: "50%",
                      background: CHART_COLORS[ai % CHART_COLORS.length],
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day details */}
      {selected && (
        <div style={{
          marginTop: "20px", padding: "16px", borderRadius: "12px",
          background: t.surface, border: `1px solid ${t.border}`,
        }}>
          <div style={{ fontWeight: 700, color: t.text, marginBottom: "10px" }}>
            {monthNames[month - 1]} {selected}, {year}
          </div>
          {dayActivities.length === 0 ? (
            <p style={{ color: t.textMuted, margin: 0, fontSize: "0.88rem" }}>No activities logged this day.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {dayActivities.map((a, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                  <span style={{ color: t.text }}>{a.name}</span>
                  <span style={{ color: "#6366F1", fontWeight: 600 }}>{a.hours}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATIONS PANEL ──────────────────────────────────────────────────────
function NotificationsPanel({ theme: t, onClose }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    axios.get(`${API}/notifications`, { headers: authHeaders() })
      .then(r => setNotifications(r.data))
      .catch(() => {});
  }, []);

  const typeColors = { info: "#6366F1", success: "#10B981", warning: "#F59E0B", error: "#EF4444" };
  const typeIcons = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" };

  return (
    <div style={{
      position: "fixed", top: "70px", right: "24px",
      width: "360px", maxHeight: "480px",
      background: t === themes.dark ? "#0F172A" : "#fff",
      border: `1px solid ${t.border}`, borderRadius: "18px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      zIndex: 1000, overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontWeight: 700, color: t.text, fontSize: "1rem" }}>🔔 Notifications</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
      </div>
      <div style={{ overflowY: "auto", maxHeight: "400px" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: t.textMuted, fontSize: "0.9rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>🔔</div>
            No notifications yet
          </div>
        ) : notifications.map(n => (
          <div key={n._id} style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${t.border}`,
            background: n.read ? "transparent" : (t === themes.dark ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.03)"),
          }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.2rem" }}>{typeIcons[n.type] || "ℹ️"}</span>
              <div>
                <div style={{ fontWeight: 600, color: t.text, fontSize: "0.88rem" }}>{n.title}</div>
                <div style={{ color: t.textMuted, fontSize: "0.8rem", marginTop: "3px" }}>{n.message}</div>
                <div style={{ color: t.textFaint, fontSize: "0.74rem", marginTop: "4px" }}>
                  {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ACHIEVEMENTS PAGE ────────────────────────────────────────────────────────
function AchievementsPage({ theme: t, activities }) {
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    axios.get(`${API}/achievements`, { headers: authHeaders() })
      .then(r => setAchievements(r.data))
      .catch(() => {});
  }, []);

  // Derive local achievements from activity data
  const totalHours = activities.reduce((s, a) => s + Number(a.hours || 0), 0);
  const localAchievements = [
    { icon: "🌱", title: "First Steps", description: "Log your very first activity", unlocked: activities.length >= 1 },
    { icon: "🔥", title: "On Fire", description: "Log 5 activities", unlocked: activities.length >= 5 },
    { icon: "💎", title: "Diamond Tracker", description: "Log 20 activities", unlocked: activities.length >= 20 },
    { icon: "⏱", title: "Hour Power", description: "Reach 10 total hours", unlocked: totalHours >= 10 },
    { icon: "🚀", title: "Century Club", description: "Reach 100 total hours", unlocked: totalHours >= 100 },
    { icon: "🏆", title: "Productivity King", description: "Reach 500 total hours", unlocked: totalHours >= 500 },
    { icon: "🎯", title: "Goal Setter", description: "Create your first goal", unlocked: false },
    { icon: "🔥", title: "FocusFire Pro", description: "Complete 10 FocusFire sessions", unlocked: false },
  ];

  const allAchievements = [...localAchievements, ...achievements];
  const unlocked = allAchievements.filter(a => a.unlocked).length;

  return (
    <div>
      <div style={{ ...glassCard(t), marginBottom: "24px", textAlign: "center", padding: "28px" }}>
        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>🏆</div>
        <div style={{ fontSize: "2.5rem", fontWeight: 800, color: t.text }}>{unlocked}/{allAchievements.length}</div>
        <div style={{ color: t.textMuted, fontSize: "0.9rem" }}>Achievements Unlocked</div>
        <div style={{ height: "6px", borderRadius: "3px", background: t.surface, marginTop: "16px", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: "3px",
            width: `${(unlocked / allAchievements.length) * 100}%`,
            background: "linear-gradient(90deg, #6366F1, #EC4899)",
            transition: "width 0.8s ease",
          }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
        {allAchievements.map((a, i) => (
          <div key={i} style={{
            ...glassCard(t), padding: "20px", textAlign: "center",
            opacity: a.unlocked ? 1 : 0.4,
            filter: a.unlocked ? "none" : "grayscale(1)",
            transition: "all 0.3s",
            border: a.unlocked ? `1px solid rgba(99,102,241,0.4)` : `1px solid ${t.border}`,
            boxShadow: a.unlocked ? "0 8px 24px rgba(99,102,241,0.15)" : "none",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>{a.icon}</div>
            <div style={{ fontWeight: 700, color: t.text, fontSize: "0.88rem", marginBottom: "4px" }}>{a.title}</div>
            <div style={{ color: t.textMuted, fontSize: "0.76rem", lineHeight: 1.4 }}>{a.description}</div>
            {a.unlocked && (
              <div style={{ marginTop: "10px", color: "#4ADE80", fontSize: "0.74rem", fontWeight: 600 }}>✓ Unlocked</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
function ProfilePage({ user, theme: t, onUpdate }) {
  const [name, setName] = useState(user.name || "");
  const [saving, setSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/profile`, { name }, { headers: authHeaders() });
      onUpdate({ ...user, name });
      alert("Profile updated!");
    } catch (e) { alert("Failed to update profile"); }
    setSaving(false);
  };

  const exportData = async () => {
    setExportLoading(true);
    try {
      const r = await axios.get(`${API}/export/data`, { headers: authHeaders() });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "lifelens-export.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Export failed"); }
    setExportLoading(false);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      {/* Avatar */}
      <div style={{ ...glassCard(t), textAlign: "center", marginBottom: "20px", padding: "32px" }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%", margin: "0 auto 16px",
          background: "linear-gradient(135deg, #6366F1, #EC4899)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "2rem", color: "white", fontWeight: 800,
        }}>
          {user.name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: "1.3rem", fontWeight: 800, color: t.text }}>{user.name}</div>
        <div style={{ color: t.textMuted, fontSize: "0.88rem", marginTop: "4px" }}>{user.email}</div>
      </div>

      {/* Edit profile */}
      <div style={{ ...glassCard(t), marginBottom: "20px" }}>
        <h3 style={sectionHeading(t)}>✏️ Edit Profile</h3>
        <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)}
          style={{ ...inputStyle(t), marginBottom: "16px" }} />
        <button onClick={saveProfile} disabled={saving}
          style={{ ...primaryBtn, width: "100%", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Export */}
      <div style={{ ...glassCard(t), marginBottom: "20px" }}>
        <h3 style={sectionHeading(t)}>📤 Export Data</h3>
        <p style={{ color: t.textMuted, fontSize: "0.88rem", marginBottom: "16px" }}>
          Download all your LifeLens data as a JSON file.
        </p>
        <button onClick={exportData} disabled={exportLoading} style={{
          width: "100%", padding: "13px", borderRadius: "12px", border: `1px solid ${t.border}`,
          background: t.surface, color: t.text, fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
          opacity: exportLoading ? 0.7 : 1,
        }}>
          {exportLoading ? "Exporting…" : "⬇️ Download My Data"}
        </button>
      </div>

      {/* Account info */}
      <div style={glassCard(t)}>
        <h3 style={sectionHeading(t)}>🔐 Account</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: t.textMuted, fontSize: "0.88rem" }}>Email</span>
            <span style={{ color: t.text, fontSize: "0.88rem" }}>{user.email}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: t.textMuted, fontSize: "0.88rem" }}>Plan</span>
            <span style={{
              color: "#6366F1", fontSize: "0.78rem", fontWeight: 700,
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "6px", padding: "2px 8px",
            }}>Free</span>
          </div>
          <div style={{ height: "1px", background: t.border }} />
          <p style={{ color: t.textFaint, fontSize: "0.8rem", margin: 0 }}>
            Password reset is not yet available. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS SECTION ────────────────────────────────────────────────────────
function AnalyticsSection({ activities, totalHours, topActivity, theme: t }) {
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    axios.get(`${API}/analytics/weekly`, { headers: authHeaders() })
      .then(r => setWeeklyData(Object.entries(r.data.weekly_data || {}).map(([k, v]) => ({ name: k, hours: v }))))
      .catch(() => {});
    axios.get(`${API}/analytics/monthly`, { headers: authHeaders() })
      .then(r => setMonthlyData(Object.entries(r.data.monthly_data || {}).map(([k, v]) => ({ name: k, hours: v }))))
      .catch(() => {});
  }, []);

  if (activities.length === 0) {
    return (
      <div style={{ ...glassCard(t), textAlign: "center", padding: "48px", marginBottom: "28px" }}>
        <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📊</div>
        <h3 style={{ color: t.text, margin: "0 0 8px" }}>No Analytics Yet</h3>
        <p style={{ color: t.textMuted, margin: 0 }}>Log some activities to unlock insights.</p>
      </div>
    );
  }

  const avgHours = (totalHours / activities.length).toFixed(1);
  const productivityScore = Math.min(100, Math.round(totalHours * 5));
  const chartData = activities.map(a => ({ name: a.name, hours: Number(a.hours) || 0 }));

  return (
    <div style={{ marginBottom: "28px" }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Hours", value: totalHours.toFixed(1), icon: "⏱", color: "#6366F1" },
          { label: "Activities", value: activities.length, icon: "📋", color: "#8B5CF6" },
          { label: "Top Activity", value: topActivity?.name || "—", icon: "🏆", color: "#EC4899", small: true },
          { label: "Avg Hours", value: avgHours, icon: "📐", color: "#F59E0B" },
          { label: "Score", value: `${productivityScore}%`, icon: "🎯", color: "#10B981" },
        ].map((card, i) => (
          <div key={i} style={{
            background: `linear-gradient(135deg, ${card.color}22, ${card.color}11)`,
            border: `1px solid ${card.color}44`, borderRadius: "18px", padding: "20px",
            backdropFilter: "blur(12px)", boxShadow: `0 8px 24px ${card.color}22`,
            transition: "transform 0.2s, box-shadow 0.2s", cursor: "default",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 16px 36px ${card.color}33`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 8px 24px ${card.color}22`; }}
          >
            <div style={{ fontSize: "1.4rem", marginBottom: "8px" }}>{card.icon}</div>
            <div style={{ color: "#94A3B8", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</div>
            <div style={{ color: "white", fontSize: card.small ? "1rem" : "1.8rem", fontWeight: 800, marginTop: "4px", lineHeight: 1.2, wordBreak: "break-word" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div style={glassCard(t)}>
          <h3 style={chartHeading(t)}>🥧 Activity Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData} dataKey="hours" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={45} paddingAngle={3}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={{ stroke: "#94A3B8", strokeWidth: 1 }}>
                {chartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} stroke="none" />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color: "#CBD5E1", fontSize: "12px" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={glassCard(t)}>
          <h3 style={chartHeading(t)}>📊 Hours per Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} tickLine={false} angle={-25} textAnchor="end" />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                {chartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend */}
      <div style={{ ...glassCard(t), marginBottom: "20px" }}>
        <h3 style={chartHeading(t)}>📉 Activity Trend</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} tickLine={false} angle={-20} textAnchor="end" />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="hours" stroke="#6366F1" strokeWidth={3} fill="url(#areaGrad)"
              dot={{ fill: "#6366F1", r: 5, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 7, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly + Monthly */}
      {(weeklyData.length > 0 || monthlyData.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {weeklyData.length > 0 && (
            <div style={glassCard(t)}>
              <h3 style={chartHeading(t)}>📅 Weekly View</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {monthlyData.length > 0 && (
            <div style={glassCard(t)}>
              <h3 style={chartHeading(t)}>📆 Monthly View</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="hours" stroke="#EC4899" strokeWidth={2.5}
                    dot={{ fill: "#EC4899", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function App() {
  const [isSignup, setIsSignup] = useState(false);
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activities, setActivities] = useState([]);
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState("");
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  const t = darkMode ? themes.dark : themes.light;

  useEffect(() => {
    const savedUser = localStorage.getItem("lifelens_user");
    const savedTheme = localStorage.getItem("lifelens_theme");
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedTheme) setDarkMode(savedTheme === "dark");
  }, []);

  useEffect(() => {
    if (user) { fetchActivities(); fetchTasks(); }
  }, [user]);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("lifelens_theme", next ? "dark" : "light");
    // Sync with backend
    axios.put(`${API}/theme`, { theme: next ? "dark" : "light" }, { headers: authHeaders() }).catch(() => {});
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) return alert("Please fill all fields");
    if (password.length < 6) return alert("Password must be at least 6 characters");
    try {
      await axios.post(`${API}/signup`, { name: name.trim(), email: email.trim(), password: password.trim() });
      alert("Signup successful! Please login.");
      setIsSignup(false); setName(""); setEmail(""); setPassword("");
    } catch (error) { alert(error.response?.data?.error || "Signup failed"); }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return alert("Please enter email and password");
    try {
      const response = await axios.post(`${API}/login`, { email: email.trim(), password: password.trim() });
      setUser(response.data.user);
      localStorage.setItem("lifelens_user", JSON.stringify(response.data.user));
      localStorage.setItem("authToken", response.data.token);
    } catch (error) { alert(error.response?.data?.error || "Login failed"); }
  };

  const logout = () => {
    localStorage.removeItem("lifelens_user");
    localStorage.removeItem("authToken");
    setUser(null); setActivities([]); setTasks([]);
  };

  const fetchActivities = async () => {
    try {
      const r = await axios.get(`${API}/activities`, { headers: authHeaders() });
      setActivities(r.data);
    } catch (e) { console.error(e); }
  };

  const addActivity = async () => {
    if (!activity.trim() || !hours) return alert("Please fill all fields");
    const h = parseFloat(hours);
    if (isNaN(h) || h < 0 || h > 24) return alert("Hours must be between 0 and 24");
    try {
      await axios.post(`${API}/activities`, { name: activity.trim(), hours: h }, { headers: authHeaders() });
      setActivity(""); setHours("");
      fetchActivities();
    } catch (e) { alert("Failed to save activity"); }
  };

  const deleteActivity = async (id) => {
    try {
      await axios.delete(`${API}/activities/${id}`, { headers: authHeaders() });
      fetchActivities();
    } catch (e) { alert("Failed to delete activity"); }
  };

  const fetchTasks = async () => {
    try {
      const r = await axios.get(`${API}/tasks`, { headers: authHeaders() });
      setTasks(r.data);
    } catch (e) { console.error(e); }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return alert("Please enter a task title");
    try {
      await axios.post(`${API}/tasks`, { title: taskTitle.trim() }, { headers: authHeaders() });
      setTaskTitle(""); fetchTasks();
    } catch (e) { alert("Failed to add task"); }
  };

  const toggleTask = async (task) => {
    try {
      await axios.put(`${API}/tasks/${task._id}`, { completed: !task.completed }, { headers: authHeaders() });
      fetchTasks();
    } catch (e) { alert("Failed to update task"); }
  };

  const deleteTask = async (id) => {
    try {
      await axios.delete(`${API}/tasks/${id}`, { headers: authHeaders() });
      fetchTasks();
    } catch (e) { alert("Failed to delete task"); }
  };

  const totalHours = activities.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const topActivity = activities.length > 0
    ? activities.reduce((max, item) => Number(item.hours) > Number(max.hours) ? item : max)
    : null;
  const completedTasks = tasks.filter(t => t.completed).length;

  const tabs = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "tasks", icon: "✅", label: "Tasks" },
    { id: "pomodoro", icon: "🔥", label: "FocusFire" },
    { id: "goals", icon: "🎯", label: "Goals" },
    { id: "calendar", icon: "📅", label: "Calendar" },
    { id: "achievements", icon: "🏆", label: "Achievements" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  if (user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: t.bg,
        fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
        position: "relative", overflowX: "hidden",
        transition: "background 0.3s ease",
      }}>
        {/* Background glows */}
        <div style={{ position: "fixed", top: "-15%", left: "-10%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        {showNotifications && <NotificationsPanel theme={t} onClose={() => setShowNotifications(false)} />}

        <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "24px", position: "relative", zIndex: 1 }}>

          {/* ── HEADER ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "800", letterSpacing: "-1px" }}>
                <span style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA, #F472B6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🌟 LifeLens</span>
              </h1>
              <p style={{ margin: "3px 0 0", color: t.textFaint, fontSize: "0.85rem" }}>
                Welcome back, <span style={{ color: "#A5B4FC", fontWeight: 600 }}>{user.name}</span>
              </p>
            </div>

            {/* Right controls */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Theme toggle */}
              <button onClick={toggleTheme} title={darkMode ? "Switch to Light" : "Switch to Dark"} style={{
                padding: "9px 14px", borderRadius: "10px", border: `1px solid ${t.border}`,
                background: t.surface, color: t.text, cursor: "pointer", fontSize: "1rem",
                transition: "all 0.2s",
              }}>
                {darkMode ? "☀️" : "🌙"}
              </button>

              {/* Notifications bell */}
              <button onClick={() => setShowNotifications(s => !s)} style={{
                padding: "9px 14px", borderRadius: "10px", border: `1px solid ${t.border}`,
                background: t.surface, color: t.text, cursor: "pointer", fontSize: "1rem",
                position: "relative", transition: "all 0.2s",
              }}>
                🔔
              </button>

              <button onClick={logout} style={{
                padding: "9px 16px", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px",
                background: "rgba(239,68,68,0.1)", color: "#FCA5A5",
                fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
              }}>Sign Out</button>
            </div>
          </div>

          {/* ── NAV TABS ── */}
          <div style={{
            display: "flex", gap: "6px", marginBottom: "28px",
            flexWrap: "wrap", padding: "8px",
            background: t.surface, borderRadius: "16px",
            border: `1px solid ${t.border}`,
          }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "8px 14px", borderRadius: "10px", border: "none", cursor: "pointer",
                background: activeTab === tab.id ? "linear-gradient(135deg, #6366F1, #8B5CF6)" : "transparent",
                color: activeTab === tab.id ? "white" : t.textMuted,
                fontWeight: 600, fontSize: "0.8rem", transition: "all 0.2s",
                boxShadow: activeTab === tab.id ? "0 4px 14px rgba(99,102,241,0.35)" : "none",
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── DASHBOARD ── */}
          {activeTab === "dashboard" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                {[
                  { label: "Total Hours", value: totalHours.toFixed(1), sub: "hrs tracked", icon: "⏱", grad: "linear-gradient(135deg, #6366F1, #8B5CF6)" },
                  { label: "Activities", value: activities.length, sub: "logged entries", icon: "📋", grad: "linear-gradient(135deg, #EC4899, #F43F5E)" },
                  { label: "Tasks Done", value: `${completedTasks}/${tasks.length}`, sub: "completed today", icon: "✅", grad: "linear-gradient(135deg, #10B981, #059669)" },
                  { label: "Score", value: `${Math.min(100, Math.round(totalHours * 5))}%`, sub: "productivity index", icon: "🎯", grad: "linear-gradient(135deg, #F59E0B, #EF4444)" },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: s.grad, borderRadius: "20px", padding: "22px",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.2)", position: "relative", overflow: "hidden",
                    transition: "transform 0.2s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                  >
                    <div style={{ position: "absolute", right: "16px", top: "16px", fontSize: "1.8rem", opacity: 0.2 }}>{s.icon}</div>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                    <div style={{ color: "white", fontSize: "2.2rem", fontWeight: 800, margin: "6px 0 3px", lineHeight: 1.1 }}>{s.value}</div>
                    <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.8rem" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Log Activity */}
              <div style={{ ...glassCard(t), marginBottom: "24px" }}>
                <h2 style={sectionHeading(t)}>➕ Log Activity</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <input type="text" placeholder="Activity name (e.g. Study, Gym…)"
                    value={activity} onChange={e => setActivity(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addActivity()}
                    style={inputStyle(t)} />
                  <input type="number" step="0.1" min="0" max="24" placeholder="Hours spent (0–24)"
                    value={hours} onChange={e => setHours(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addActivity()}
                    style={inputStyle(t)} />
                </div>
                <button onClick={addActivity} style={{ ...primaryBtn, width: "100%" }}>Save Activity</button>
              </div>

              {/* Activities list */}
              {activities.length > 0 ? (
                <div style={glassCard(t)}>
                  <h2 style={sectionHeading(t)}>📋 Saved Activities</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {activities.map((item, idx) => (
                      <div key={item._id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 18px", background: t.surface,
                        border: `1px solid ${t.border}`, borderRadius: "14px",
                        transition: "background 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                        onMouseLeave={e => e.currentTarget.style.background = t.surface}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: CHART_COLORS[idx % CHART_COLORS.length], flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: t.text, fontSize: "0.92rem" }}>{item.name}</div>
                            <div style={{ color: t.textFaint, fontSize: "0.78rem", marginTop: "2px" }}>
                              {item.hours} hours {item.date ? `· ${item.date}` : ""}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteActivity(item._id)} style={{
                          background: "rgba(239,68,68,0.1)", color: "#FCA5A5",
                          border: "1px solid rgba(239,68,68,0.2)", padding: "7px 14px",
                          borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
                        }}>Delete</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ ...glassCard(t), textAlign: "center", padding: "48px" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🌱</div>
                  <h3 style={{ color: t.text, margin: "0 0 8px" }}>No activities yet</h3>
                  <p style={{ color: t.textFaint, margin: 0 }}>Start tracking your daily habits to unlock insights.</p>
                </div>
              )}
            </>
          )}

          {/* ── ANALYTICS ── */}
          {activeTab === "analytics" && (
            <AnalyticsSection activities={activities} totalHours={totalHours} topActivity={topActivity} theme={t} />
          )}

          {/* ── TASKS ── */}
          {activeTab === "tasks" && (
            <div style={glassCard(t)}>
              <h2 style={sectionHeading(t)}>✅ Daily Tasks</h2>
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <input type="text" placeholder="Add a new task…"
                  value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  style={{ ...inputStyle(t), marginBottom: 0, flex: 1 }} />
                <button onClick={addTask} style={{
                  padding: "12px 18px", border: "none", borderRadius: "12px",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  color: "white", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                }}>+ Add</button>
              </div>
              {tasks.length === 0 ? (
                <p style={{ color: t.textFaint, textAlign: "center", padding: "24px 0" }}>No tasks yet. Add one above!</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {tasks.map(task => (
                    <div key={task._id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "13px 16px",
                      background: task.completed ? "rgba(16,185,129,0.06)" : t.surface,
                      border: `1px solid ${task.completed ? "rgba(16,185,129,0.2)" : t.border}`,
                      borderRadius: "12px", transition: "all 0.2s",
                    }}>
                      <div onClick={() => toggleTask(task)} style={{
                        flex: 1, cursor: "pointer",
                        textDecoration: task.completed ? "line-through" : "none",
                        color: task.completed ? "#4ADE80" : t.text,
                        fontWeight: 500, display: "flex", alignItems: "center", gap: "12px",
                      }}>
                        <span style={{
                          width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0,
                          background: task.completed ? "rgba(16,185,129,0.3)" : "transparent",
                          border: `2px solid ${task.completed ? "#10B981" : "#475569"}`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px",
                        }}>{task.completed ? "✓" : ""}</span>
                        {task.title}
                      </div>
                      <button onClick={() => deleteTask(task._id)} style={{
                        background: "rgba(239,68,68,0.1)", color: "#FCA5A5",
                        border: "1px solid rgba(239,68,68,0.2)", padding: "6px 12px",
                        borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                        marginLeft: "10px", flexShrink: 0,
                      }}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── POMODORO ── */}
          {activeTab === "pomodoro" && <PomodoroTimer theme={t} />}

          {/* ── GOALS ── */}
          {activeTab === "goals" && <GoalsPage theme={t} />}

          {/* ── CALENDAR ── */}
          {activeTab === "calendar" && <CalendarView theme={t} />}

          {/* ── ACHIEVEMENTS ── */}
          {activeTab === "achievements" && <AchievementsPage theme={t} activities={activities} />}

          {/* ── PROFILE ── */}
          {activeTab === "profile" && (
            <ProfilePage user={user} theme={t} onUpdate={u => {
              setUser(u);
              localStorage.setItem("lifelens_user", JSON.stringify(u));
            }} />
          )}

        </div>
      </div>
    );
  }

  // ─── AUTH PAGE ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
      background: "#020817",
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1,
        backgroundImage: 'url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80")',
        backgroundSize: "cover", backgroundPosition: "center",
        position: "relative", display: "flex", alignItems: "center", padding: "60px",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(2,8,23,0.75) 0%, rgba(79,70,229,0.3) 100%)" }} />
        <div style={{ position: "relative", color: "white", maxWidth: "480px" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.15em", color: "#A5B4FC", textTransform: "uppercase", marginBottom: "24px" }}>🌟 LifeLens</div>
          <h1 style={{ fontSize: "5rem", fontWeight: 900, lineHeight: 0.9, margin: "0 0 28px", letterSpacing: "-3px" }}>
            TRACK<br />YOUR<br />LIFE
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.75, opacity: 0.85, maxWidth: "360px" }}>
            Where your productivity becomes visible. Analyze your habits, spot patterns, and achieve your goals with clarity.
          </p>
          <div style={{ display: "flex", gap: "28px", marginTop: "48px" }}>
            {["Activities", "Analytics", "FocusFire", "Goals"].map(f => (
              <div key={f} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#818CF8" }}>✦</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginTop: "4px" }}>{f}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div style={{
        width: "460px", flexShrink: 0,
        background: "linear-gradient(160deg, #0F172A 0%, #1E1B4B 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "40px",
      }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <h2 style={{ color: "white", fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px", textAlign: "center" }}>
            {isSignup ? "Create Account" : "Welcome back!"}
          </h2>
          <p style={{ color: "#64748B", textAlign: "center", fontSize: "0.88rem", marginBottom: "28px" }}>
            {isSignup ? "Join LifeLens and start your journey." : "Sign in to your LifeLens account"}
          </p>

          {isSignup && (
            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={authInputStyle} />
          )}
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={authInputStyle} />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (isSignup ? handleSignup() : handleLogin())}
            style={authInputStyle} />

          {!isSignup && (
            <div style={{ textAlign: "right", marginBottom: "18px" }}>
              <span style={{ color: "#818CF8", fontSize: "0.83rem", cursor: "pointer" }}>Forgot password?</span>
            </div>
          )}

          <button onClick={isSignup ? handleSignup : handleLogin} style={{
            width: "100%", padding: "14px", border: "none", borderRadius: "12px",
            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
            color: "white", fontSize: "0.92rem", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 12px 28px rgba(99,102,241,0.35)", letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            {isSignup ? "Create Account" : "Sign In"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ color: "#475569", fontSize: "0.83rem" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          <button style={{
            width: "100%", padding: "13px", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px", background: "rgba(255,255,255,0.05)",
            color: "#E2E8F0", fontWeight: 600, display: "flex",
            justifyContent: "center", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.88rem",
          }}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: "18px" }} />
            Sign in with Google (Coming Soon)
          </button>

          <p style={{ color: "#475569", textAlign: "center", fontSize: "0.88rem", marginTop: "24px" }}>
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <span onClick={() => { setIsSignup(!isSignup); setName(""); setEmail(""); setPassword(""); }}
              style={{ color: "#818CF8", fontWeight: 700, cursor: "pointer" }}>
              {isSignup ? "Sign In" : "Sign Up"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED STYLE HELPERS ─────────────────────────────────────────────────────
const glassCard = (t) => ({
  background: t.card.background,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${t.card.border}`,
  borderRadius: "20px",
  padding: "24px",
  boxShadow: t.card.shadow,
});

const sectionHeading = (t) => ({
  margin: "0 0 18px",
  fontSize: "1.1rem",
  fontWeight: 700,
  color: t.text,
  letterSpacing: "-0.3px",
});

const chartHeading = (t) => ({
  margin: "0 0 14px",
  fontSize: "0.95rem",
  fontWeight: 700,
  color: t.text,
});

const inputStyle = (t) => ({
  width: "100%",
  padding: "12px 15px",
  background: t.input.background,
  border: `1px solid ${t.input.border}`,
  borderRadius: "10px",
  color: t.input.color,
  fontSize: "0.92rem",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
});

const primaryBtn = {
  padding: "13px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  color: "white",
  fontSize: "0.92rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
  letterSpacing: "0.03em",
};

const navBtn = (t) => ({
  padding: "8px 14px", borderRadius: "10px", border: `1px solid ${t.border}`,
  background: t.surface, color: t.text, cursor: "pointer", fontSize: "1rem",
  fontWeight: 700, transition: "all 0.2s",
});

const authInputStyle = {
  width: "100%",
  padding: "13px 15px",
  marginBottom: "12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "white",
  fontSize: "0.92rem",
  outline: "none",
  boxSizing: "border-box",
};

export default App;