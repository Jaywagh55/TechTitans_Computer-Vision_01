import { useState, useEffect } from "react"
import { VIDEOS, loadSummary } from "../api/data.js"
import { Link } from "react-router-dom"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

const s = {
  page: { padding: 24 },
  sectionLabel: { fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 },
  teamSection: { marginBottom: 40 },
  teamGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 },
  teamCard: {
    background: "#161b2e", border: "1px solid #2a3050", borderRadius: 16, padding: 28,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
    position: "relative", overflow: "hidden",
  },
  stripe: (color) => ({
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
  }),
  avatarWrap: (color) => ({
    width: 90, height: 90, borderRadius: "50%",
    border: `3px solid ${color}`, background: `${color}20`,
    overflow: "hidden", flexShrink: 0,
  }),
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  name: { fontSize: 17, fontWeight: 700, color: "#e2e8f0", textAlign: "center" },
  role: (color) => ({ fontSize: 12, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center" }),
  bio: { fontSize: 13, color: "#64748b", lineHeight: 1.65, textAlign: "center" },
  skillsWrap: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 4 },
  skill: (color) => ({
    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
    background: `${color}18`, color, border: `1px solid ${color}33`,
  }),
  videoRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 16, marginBottom: 32 },
  videoCard: { background: "#161b2e", border: "1px solid #2a3050", borderRadius: 12, padding: 20 },
  videoCardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  videoTitle: { fontSize: 15, fontWeight: 600, color: "#e2e8f0" },
  statusPill: (status) => ({
    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
    background: status === "complete" ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
    color: status === "complete" ? "#22c55e" : "#eab308",
    border: `1px solid ${status === "complete" ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
  }),
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 8 },
  stat: { background: "#0f1117", borderRadius: 8, padding: "10px 12px", textAlign: "center" },
  statNum: { fontSize: 20, fontWeight: 700, color: "#7dd3fc" },
  statLbl: { fontSize: 11, color: "#475569", marginTop: 2 },
  chartSection: { marginTop: 16 },
  chartTitle: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  sizeRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 },
  sizeBadge: (color) => ({
    background: `${color}18`, border: `1px solid ${color}44`,
    borderRadius: 8, padding: "8px 0", textAlign: "center",
  }),
  sizeBadgeNum: (color) => ({ fontSize: 18, fontWeight: 700, color }),
  sizeBadgeLabel: { fontSize: 11, color: "#64748b", marginTop: 2 },
  actions: { display: "flex", gap: 12, marginTop: 16 },
  btn: {
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "1px solid #2a3050", cursor: "pointer",
    background: "#0f1117", color: "#7dd3fc", textDecoration: "none", display: "inline-flex", alignItems: "center",
  },
}

const TEAM = [
  {
    name: "Jay Wagh",
    role: "Computer Vision Lead",
    bio: "Leads the YOLOv8 model architecture, stone detection heuristics, and the end-to-end inference pipeline for kidney stone localization.",
    img: "/team/Jay wagh.jpeg",
    color: "#7dd3fc",
    skills: ["YOLOv8", "OpenCV", "Python", "Deep Learning"],
  },
  {
    name: "Siddhant Pawale",
    role: "Medical Imaging & UI Developer",
    bio: "Designed the CLAHE pre-processing pipeline, FOV-calibrated size estimation, and built the React dashboard for visualizing results.",
    img: "/team/Siddhant pawale.jpeg",
    color: "#a78bfa",
    skills: ["CLAHE", "React", "Image Processing", "UI/UX"],
  },
]

const LASER_COLORS = ["#22c55e", "#ef4444", "#eab308"]

function VideoSummaryCard({ video }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSummary(video.id).then(s => { setSummary(s); setLoading(false) })
  }, [video.id])

  const totalFrames = summary?.total_frames || "—"
  const framesWithStones = summary?.frames_with_stones || 0
  const totalDets = summary?.total_stone_detections || 0
  const safe = summary?.laser_safe || 0
  const notSafe = summary?.laser_not_safe || 0
  const uncertain = summary?.laser_uncertain || 0
  const laserTotal = safe + notSafe + uncertain || 1
  const sizeDist = summary?.size_distribution || {}
  const isComplete = !!summary

  const laserData = [
    { name: "Safe", value: safe, fill: "#22c55e" },
    { name: "Not Safe", value: notSafe, fill: "#ef4444" },
    { name: "Uncertain", value: uncertain, fill: "#eab308" },
  ]

  const sizeData = [
    { name: "<5mm", count: sizeDist["<5mm"] || 0, fill: "#22c55e" },
    { name: "5-10mm", count: sizeDist["5-10mm"] || 0, fill: "#eab308" },
    { name: ">10mm", count: sizeDist[">10mm"] || 0, fill: "#ef4444" },
  ]

  return (
    <div style={s.videoCard}>
      <div style={s.videoCardHeader}>
        <span style={s.videoTitle}>{video.label}</span>
        <span style={s.statusPill(isComplete ? "complete" : "processing")}>
          {loading ? "Loading..." : isComplete ? "Complete" : "Processing"}
        </span>
      </div>

      <div style={s.statsRow}>
        <div style={s.stat}>
          <div style={s.statNum}>{totalFrames}</div>
          <div style={s.statLbl}>Total Frames</div>
        </div>
        <div style={s.stat}>
          <div style={s.statNum}>{framesWithStones}</div>
          <div style={s.statLbl}>Stone Frames</div>
        </div>
        <div style={s.stat}>
          <div style={s.statNum}>{totalDets}</div>
          <div style={s.statLbl}>Detections</div>
        </div>
      </div>

      {/* Laser Alignment Chart */}
      <div style={s.chartSection}>
        <div style={s.chartTitle}>Laser Alignment Distribution</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, height: 160 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={laserData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                {laserData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <ResponsiveContainer>
            <BarChart data={laserData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0f1117", border: "1px solid #2a3050", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {laserData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stone Size Distribution */}
      <div style={s.chartSection}>
        <div style={s.chartTitle}>Stone Size Distribution</div>
        <div style={{ height: 120 }}>
          <ResponsiveContainer>
            <BarChart data={sizeData}>
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#0f1117", border: "1px solid #2a3050", borderRadius: 8 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sizeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={s.actions}>
        <Link to="/frames" style={s.btn}>View Frames</Link>
        <Link to="/player" style={s.btn}>Watch Video</Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div style={s.page}>
      {/* Team Section */}
      <div style={s.teamSection}>
        <div style={s.sectionLabel}>Team</div>
        <div style={s.teamGrid}>
          {TEAM.map(m => (
            <div key={m.name} style={s.teamCard}>
              <div style={s.stripe(m.color)} />
              <div style={s.avatarWrap(m.color)}>
                <img src={m.img} alt={m.name} style={s.avatarImg} />
              </div>
              <div style={s.name}>{m.name}</div>
              <div style={s.role(m.color)}>{m.role}</div>
              <div style={s.bio}>{m.bio}</div>
              <div style={s.skillsWrap}>
                {m.skills.map(sk => <span key={sk} style={s.skill(m.color)}>{sk}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video Analysis Results */}
      <div style={s.sectionLabel}>Video Analysis Results</div>
      <div style={s.videoRow}>
        {VIDEOS.map(v => <VideoSummaryCard key={v.id} video={v} />)}
      </div>
    </div>
  )
}