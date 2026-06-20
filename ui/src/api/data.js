/**
 * data.js – helpers that load RIRS pipeline outputs from the local filesystem
 * via the Vite static asset import mechanism.
 *
 * Since we serve the outputs/ folder as a static directory (configured in
 * vite.config.js), all paths are relative to /outputs/ on the dev server.
 */

export const VIDEOS = [
  { id: "test_video", label: "Test Video 1", mp4: "/outputs/annotated_videos/test_video_annotated.mp4" },
  { id: "test_video_2", label: "Test Video 2", mp4: "/outputs/annotated_videos/test_video_2_annotated.mp4" },
];

/**
 * Load the summary JSON for a video.
 * Falls back gracefully if the file is not yet generated.
 */
export async function loadSummary(videoId) {
  try {
    const res = await fetch(`/outputs/annotated_frames/${videoId}/summary.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Build a list of frame objects for a video.
 * We probe /outputs/annotated_frames/{videoId}/post_frame_XXXXX.jpg
 * by iterating known indices stored in the summary, or probing up to maxFrames.
 */
export async function loadFrameList(videoId, maxProbe = 500) {
  const summary = await loadSummary(videoId);
  const frames = [];

  if (summary && summary.per_frame) {
    for (const entry of summary.per_frame) {
      const idx = entry.frame;
      const paddedIdx = String(idx).padStart(5, "0");
      frames.push({
        index: idx,
        pre: `/outputs/annotated_frames/${videoId}/pre_frame_${paddedIdx}.jpg`,
        post: `/outputs/annotated_frames/${videoId}/post_frame_${paddedIdx}.jpg`,
        stones: entry.stones,
        laser: entry.laser,
        sizes: entry.sizes || [],
      });
    }
    return frames;
  }

  // Fallback: probe every FRAME_SAVE_EVERY-th frame (default 5)
  for (let i = 0; i < maxProbe; i += 5) {
    const paddedIdx = String(i).padStart(5, "0");
    frames.push({
      index: i,
      pre: `/outputs/annotated_frames/${videoId}/pre_frame_${paddedIdx}.jpg`,
      post: `/outputs/annotated_frames/${videoId}/post_frame_${paddedIdx}.jpg`,
      stones: null,
      laser: "unknown",
      sizes: [],
    });
  }
  return frames;
}

export function laserStatusColor(status) {
  switch (status) {
    case "safe_to_shoot": return "#22c55e";
    case "not_safe_to_shoot": return "#ef4444";
    case "uncertain": return "#eab308";
    default: return "#6b7280";
  }
}

export function laserStatusLabel(status) {
  switch (status) {
    case "safe_to_shoot": return "Safe to Shoot";
    case "not_safe_to_shoot": return "Not Safe";
    case "uncertain": return "Uncertain";
    default: return "Unknown";
  }
}
