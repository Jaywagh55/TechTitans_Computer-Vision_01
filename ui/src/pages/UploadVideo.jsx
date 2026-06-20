import { useRef, useState } from "react"
import { useJob } from "../api/JobContext"
import { Link } from "react-router-dom"
import { FrameViewer } from "../components/FrameViewer"
import { jsPDF } from "jspdf"

const API = "http://localhost:8000"

const s = {
  page: { padding: 24, maxWidth: 900 },
  sectionLabel: { fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 },
  dropzone: {
    border: "2px dashed #3a4070", borderRadius: 16, padding: "48px 32px",
    textAlign: "center", cursor: "pointer", background: "#0f1117",
    transition: "border-color 0.2s", marginBottom: 16,
  },
  dropzoneActive: {
    border: "2px dashed #7dd3fc", borderRadius: 16, padding: "48px 32px",
    textAlign: "center", cursor: "pointer", background: "#0a1628",
    transition: "border-color 0.2s", marginBottom: 16,
  },
  dropIcon: { color: "#7dd3fc", fontSize: 36, marginBottom: 10 },
  dropText: { color: "#94a3b8", fontSize: 15 },
  dropSub: { color: "#475569", fontSize: 13, marginTop: 6 },
  progressCard: { background: "#161b2e", border: "1px solid #2a3050", borderRadius: 12, padding: 20, marginBottom: 16 },
  progressHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  progressTitle: { fontSize: 15, fontWeight: 600, color: "#e2e8f0" },
  cancelBtn: {
    background: "#dc2626", color: "#fff", border: "none", borderRadius: 8,
    padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  progressBar: { height: 8, background: "#0f1117", borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  progressFill: (pct) => ({
    height: "100%", width: `${pct}%`, borderRadius: 99,
    background: "linear-gradient(90deg, #22c55e, #7dd3fc)", transition: "width 0.4s ease",
  }),
  progressMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" },
  bgNote: { fontSize: 12, color: "#475569", marginTop: 8, textAlign: "center" },
  videoPreview: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 8, display: "block" },
  videoWrap: { borderRadius: 12, overflow: "hidden", border: "1px solid #2a3050", background: "#000" },
  video: { width: "100%", display: "block", maxHeight: 360 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 12, marginBottom: 16 },
  statCard: { background: "#161b2e", border: "1px solid #2a3050", borderRadius: 10, padding: 16, textAlign: "center" },
  statNum: (c) => ({ fontSize: 26, fontWeight: 700, color: c, display: "block" }),
  statLbl: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  summaryBox: {
    background: "#161b2e", border: "1px solid #2a3050", borderRadius: 12,
    padding: 20, marginBottom: 16,
  },
  summaryTitle: { fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 },
  summaryRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e2238" },
  summaryKey: { color: "#94a3b8", fontSize: 13 },
  summaryVal: { color: "#e2e8f0", fontSize: 13, fontWeight: 500 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  btn: {
    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "1px solid #2a3050", cursor: "pointer",
    background: "#0f1117", color: "#7dd3fc", textDecoration: "none", display: "inline-flex", alignItems: "center",
  },
  btnPrimary: {
    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "none", cursor: "pointer",
    background: "#22c55e", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center",
  },
  btnPdf: {
    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "none", cursor: "pointer",
    background: "#7c3aed", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center",
  },
  viewerWrap: { marginTop: 16 },
  viewerTitle: { fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 8, display: "block" },
  viewerBox: { borderRadius: 12, overflow: "hidden", border: "1px solid #2a3050" },
  stoneFramesSection: { marginBottom: 16 },
  stoneFramesList: {
    background: "#161b2e", border: "1px solid #2a3050", borderRadius: 12,
    padding: 16, maxHeight: 200, overflowY: "auto",
  },
  stoneFrameItem: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "6px 0", borderBottom: "1px solid #1e2238",
    color: "#94a3b8", fontSize: 13,
  },
  stoneFrameNum: { fontWeight: 600, color: "#7dd3fc", fontFamily: "monospace" },
}

function formatETA(seconds) {
  if (seconds <= 0) return "Done"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function generatePdfReport(summary, filename) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // Header
  doc.setFillColor(20, 25, 50)
  doc.rect(0, 0, pageWidth, 50, "F")
  doc.setTextColor(125, 211, 252)
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("RIRS AI SURGICAL REPORT", pageWidth / 2, 25, { align: "center" })
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text("Kidney Stone Detection Analysis", pageWidth / 2, 35, { align: "center" })
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 43, { align: "center" })

  y = 65

  // Video Info
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("VIDEO INFORMATION", 20, y)
  y += 8
  doc.setFont("helvetica", "normal")
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)
  doc.text(`File: ${filename}`, 20, y); y += 6
  doc.text(`Total Frames Analyzed: ${summary.total_frames}`, 20, y); y += 6
  doc.text(`Processing Time: ${summary.processing_time}s`, 20, y); y += 10

  // Findings
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("FINDINGS", 20, y); y += 8
  doc.setFont("helvetica", "normal")
  doc.setTextColor(50, 50, 50)

  const stonesFound = summary.frames_with_stones > 0
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(stonesFound ? 220 : 34, stonesFound ? 38 : 197, stonesFound ? 38 : 94)
  doc.text(stonesFound ? "KIDNEY STONE DETECTED" : "NO STONE DETECTED", 20, y); y += 8

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(50, 50, 50)
  doc.text(`Frames with Stones: ${summary.frames_with_stones}`, 20, y); y += 6
  doc.text(`Total Stone Detections: ${summary.total_stone_detections}`, 20, y); y += 6

  const sd = summary.size_distribution || {}
  doc.text(`Size Distribution:`, 20, y); y += 6
  doc.text(`  - <5mm (Small): ${sd["<5mm"] || 0}`, 25, y); y += 5
  doc.text(`  - 5-10mm (Medium): ${sd["5-10mm"] || 0}`, 25, y); y += 5
  doc.text(`  - >10mm (Large): ${sd[">10mm"] || 0}`, 25, y); y += 5

  doc.text(`Laser Alignment:`, 20, y); y += 6
  doc.text(`  - Safe to Shoot: ${summary.laser_safe || 0}`, 25, y); y += 5
  doc.text(`  - Not Safe: ${summary.laser_not_safe || 0}`, 25, y); y += 5
  doc.text(`  - Uncertain: ${summary.laser_uncertain || 0}`, 25, y); y += 10

  // Stone Frames List
  if (summary.stone_frames && summary.stone_frames.length > 0) {
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "bold")
    doc.text("STONE DETECTED AT FRAMES", 20, y); y += 8
    doc.setFont("helvetica", "normal")
    doc.setTextColor(50, 50, 50)
    const framesText = summary.stone_frames.slice(0, 50).join(", ")
    const lines = doc.splitTextToSize(framesText, pageWidth - 40)
    lines.forEach(line => { doc.text(line, 20, y); y += 5 })
    if (summary.stone_frames.length > 50) {
      doc.text(`... and ${summary.stone_frames.length - 50} more frames`, 20, y); y += 5
    }
    y += 5
  }

  // Preventive Measures (new page if needed)
  if (y > 230) { doc.addPage(); y = 20 }

  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("PREVENTIVE MEASURES & RECOMMENDATIONS", 20, y); y += 8
  doc.setFont("helvetica", "normal")
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)

  const measures = [
    "1. HYDRATION: Drink 2.5-3 liters of water daily to prevent stone recurrence.",
    "2. DIETARY CHANGES: Reduce sodium, oxalate-rich foods (spinach, nuts, chocolate).",
    "3. CITRATE INTAKE: Increase lemon/orange juice to inhibit stone formation.",
    "4. CALCIUM: Maintain adequate dietary calcium (do NOT restrict calcium).",
    "5. PROTEIN: Limit animal protein (red meat, poultry) to reduce uric acid.",
    "6. MEDICATION: Consult urologist for alpha-blockers (tamsulosin) if stone >5mm.",
    "7. FOLLOW-UP: Schedule KUB X-ray or CT scan in 2-4 weeks for stone tracking.",
    "8. EMERGENCY: Seek immediate care if fever, severe pain, or blood in urine.",
    "9. LIFESTYLE: Regular exercise helps reduce stone risk; avoid prolonged sitting.",
    "10. MONITORING: Keep a stone diary; strain urine to collect passed stones for analysis.",
  ]

  measures.forEach(m => {
    if (y > 280) { doc.addPage(); y = 20 }
    const lines = doc.splitTextToSize(m, pageWidth - 40)
    lines.forEach(line => { doc.text(line, 20, y); y += 5 })
    y += 2
  })

  // Footer
  if (y > 260) { doc.addPage(); y = 20 }
  y += 5
  doc.setDrawColor(200, 200, 200)
  doc.line(20, y, pageWidth - 20, y); y += 8
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text("This report was generated by RIRS AI Surgical Assistant. Not a substitute for professional medical advice.", pageWidth / 2, y, { align: "center" })
  doc.text("Consult a qualified urologist for clinical decisions.", pageWidth / 2, y + 5, { align: "center" })

  doc.save(`RIRS_Report_${filename.replace(/\.[^.]+$/, "")}.pdf`)
}

export default function UploadVideo() {
  const { job, upload, cancel, reset } = useJob()
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const onFile = (file) => {
    if (file && file.type.startsWith("video/")) upload(file)
  }

  const isIdle = !job || job.status === "done" || job.status === "error" || job.status === "cancelled"
  const isActive = job && ["uploading", "queued", "processing"].includes(job.status)
  const isDone = job?.status === "done"
  const summary = job?.summary

  return (
    <div style={s.page}>
      <div style={s.sectionLabel}>Upload Video</div>

      {/* Dropzone (shown when idle or after done) */}
      {(isIdle || isDone) && (
        <div
          style={dragOver ? s.dropzoneActive : s.dropzone}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]) }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={s.dropIcon}>+</div>
          <div style={s.dropText}>Drop a video file here, or click to browse</div>
          <div style={s.dropSub}>Supports MP4, AVI, MOV formats</div>
          <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
        </div>
      )}

      {isActive && (
        <>
          {/* Instant video preview */}
          {job.videoBlob && (
            <div style={s.videoPreview}>
              <div style={s.sectionTitle}>Instant Preview: {job.filename}</div>
              <div style={s.videoWrap}>
                <video src={job.videoBlob} controls style={s.video} />
              </div>
            </div>
          )}

          {/* Progress with Cancel */}
          <div style={s.progressCard}>
            <div style={s.progressHeader}>
              <span style={s.progressTitle}>
                {job.status === "uploading" ? `Uploading video... ${job.uploadProgress || 0}%` :
                 job.status === "queued" ? "Queued — loading model..." :
                 `Analyzing frames (${job.progress}%)`}
              </span>
              <button style={s.cancelBtn} onClick={cancel}>Cancel</button>
            </div>
            <div style={s.progressBar}>
              <div style={s.progressFill(job.progress)} />
            </div>
            <div style={s.progressMeta}>
              <span>{job.processedFrames} / {job.totalFrames} frames · {job.fpsProcessing} fps</span>
              <span>ETA: {formatETA(job.eta)}</span>
            </div>
          </div>
          <div style={s.bgNote}>
            Processing continues in background. Navigate away freely.
          </div>
        </>
      )}

      {/* Analysis Complete */}
      {isDone && summary && (
        <>
          <div style={s.statsGrid}>
            <div style={s.statCard}>
              <span style={s.statNum("#7dd3fc")}>{summary.total_frames}</span>
              <div style={s.statLbl}>Total Frames</div>
            </div>
            <div style={s.statCard}>
              <span style={s.statNum(summary.frames_with_stones > 0 ? "#f97316" : "#22c55e")}>
                {summary.frames_with_stones}
              </span>
              <div style={s.statLbl}>Stone Frames</div>
            </div>
            <div style={s.statCard}>
              <span style={s.statNum("#a78bfa")}>{summary.total_stone_detections}</span>
              <div style={s.statLbl}>Detections</div>
            </div>
            <div style={s.statCard}>
              <span style={s.statNum("#f97316")}>{summary.processing_time}s</span>
              <div style={s.statLbl}>Processing Time</div>
            </div>
          </div>

          <div style={s.summaryBox}>
            <div style={s.summaryTitle}>Summary</div>
            {[
              ["Laser Safe", summary.laser_safe],
              ["Laser Not Safe", summary.laser_not_safe],
              ["Laser Uncertain", summary.laser_uncertain],
              ["Small (<5mm)", summary.size_distribution?.["<5mm"] || 0],
              ["Medium (5-10mm)", summary.size_distribution?.["5-10mm"] || 0],
              ["Large (>10mm)", summary.size_distribution?.[">10mm"] || 0],
            ].map(([k, v]) => (
              <div key={k} style={s.summaryRow}>
                <span style={s.summaryKey}>{k}</span>
                <span style={s.summaryVal}>{v}</span>
              </div>
            ))}
          </div>

          {/* Stone Frames List */}
          {summary.stone_frames && summary.stone_frames.length > 0 && (
            <div style={s.stoneFramesSection}>
              <div style={s.sectionTitle}>
                Frames with Stones ({summary.stone_frames.length})
              </div>
              <div style={s.stoneFramesList}>
                {summary.stone_frames.map((f, i) => (
                  <div key={i} style={s.stoneFrameItem}>
                    <span>Frame</span>
                    <span style={s.stoneFrameNum}>#{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={s.actions}>
            <button style={s.btn} onClick={reset}>Upload Another</button>
            <Link to="/frames" style={s.btn}>View Pre/Post Frames</Link>
            {summary.frames_with_stones > 0 && (
              <button style={s.btnPdf} onClick={() => generatePdfReport(summary, job.filename)}>
                Download Medical Report (PDF)
              </button>
            )}
          </div>

          {/* Pre/Post Viewer */}
          {job.id && (
            <div style={s.viewerWrap}>
              <div style={s.viewerTitle}>Pre-Processing vs Post-Processing</div>
              <div style={s.viewerBox}>
                <FrameViewer
                  totalFrames={summary.total_frames}
                  preUrl={idx => `${API}/api/frame/${job.id}/pre/${idx}`}
                  postUrl={idx => `${API}/api/frame/${job.id}/post/${idx}`}
                />
              </div>
            </div>
          )}
        </>
      )}

      {job?.status === "error" && (
        <div style={{ ...s.summaryBox, borderColor: "#dc2626" }}>
          <div style={{ color: "#fca5a5", fontWeight: 600 }}>Error: {job.error}</div>
          <button style={{ ...s.btn, marginTop: 12 }} onClick={reset}>Try Again</button>
        </div>
      )}

      {job?.status === "cancelled" && (
        <div style={s.summaryBox}>
          <div style={{ color: "#fbbf24", fontWeight: 600 }}>Upload cancelled.</div>
          <button style={{ ...s.btn, marginTop: 12 }} onClick={reset}>Upload New Video</button>
        </div>
      )}
    </div>
  )
}