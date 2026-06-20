import { createContext, useContext, useState, useRef, useCallback } from "react"

const API = "http://localhost:8000/api"
const JobContext = createContext(null)

export function JobProvider({ children }) {
  const [job, setJob] = useState(null) // { id, status, progress, eta, summary, videoBlob, filename }
  const pollRef = useRef(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPoll = useCallback((jobId) => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/status/${jobId}`)
        const d = await r.json()
        setJob(prev => prev ? {
          ...prev,
          status: d.status,
          progress: d.progress || 0,
          processedFrames: d.processed_frames || 0,
          totalFrames: d.total_frames || 0,
          eta: d.eta_seconds || 0,
          fpsProcessing: d.fps_processing || 0,
        } : null)

        if (d.status === "done") {
          stopPoll()
          const sr = await fetch(`${API}/summary/${jobId}`)
          if (sr.ok) {
            const summary = await sr.json()
            setJob(prev => prev ? { ...prev, summary } : null)
          }
        } else if (d.status === "error" || d.status === "cancelled") {
          stopPoll()
        }
      } catch (e) { /* ignore */ }
    }, 1000)
  }, [stopPoll])

  const upload = useCallback(async (file) => {
    const videoBlob = URL.createObjectURL(file)

    setJob({
      id: null, status: "uploading", progress: 0,
      processedFrames: 0, totalFrames: 0, eta: 0,
      videoBlob, filename: file.name, summary: null,
      uploadProgress: 0,
    })

    try {
      // Use XMLHttpRequest for upload progress tracking
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", `${API}/upload`)
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setJob(prev => prev ? { ...prev, uploadProgress: pct, progress: Math.round(pct * 0.3) } : null)
          }
        }

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error("Network error"))

        const fd = new FormData()
        fd.append("video", file)
        xhr.send(fd)
      })

      if (result.job_id) {
        setJob(prev => prev ? { ...prev, id: result.job_id, status: "queued", uploadProgress: 100 } : null)
        startPoll(result.job_id)
      } else {
        setJob(prev => prev ? { ...prev, status: "error", error: result.error } : null)
      }
    } catch (e) {
      setJob(prev => prev ? {
        ...prev, status: "error",
        error: "Cannot connect to API at localhost:8000. Start it: py api.py"
      } : null)
    }
  }, [startPoll])

  const cancel = useCallback(async () => {
    if (job?.id) {
      await fetch(`${API}/cancel/${job.id}`, { method: "POST" })
    }
    stopPoll()
    if (job?.videoBlob) URL.revokeObjectURL(job.videoBlob)
    setJob(null)
  }, [job, stopPoll])

  const reset = useCallback(() => {
    stopPoll()
    if (job?.videoBlob) URL.revokeObjectURL(job.videoBlob)
    setJob(null)
  }, [job, stopPoll])

  return (
    <JobContext.Provider value={{ job, upload, cancel, reset }}>
      {children}
    </JobContext.Provider>
  )
}

export function useJob() { return useContext(JobContext) }