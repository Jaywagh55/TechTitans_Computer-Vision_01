The Surgical Eye — AI Guidance for RIRS Kidney Stone Surgery
ethosh Ignite 2026 — Track 1: Computer Vision

Problem Statement 1
Overview

Retrograde Intrarenal Surgery (RIRS) is a minimally invasive procedure used to treat kidney stones using a flexible ureteroscope and laser lithotripsy. During the procedure, surgeons rely on live endoscopic video to identify stones, estimate their size, and safely align the laser before breaking the stone.

Surgical videos can be difficult to interpret due to changing lighting, motion blur, irrigation fluid, bubbles, debris, bleeding, tissue movement, and camera angle changes. This project builds an AI-based visual assistant to improve stone visualization and provide decision-support during the procedure.

Disclaimer: The dataset contains NSFW medical content, as it consists of real intraoperative endoscopic RIRS videos/images captured during kidney stone procedures. The content may include internal human anatomy, surgical instruments, blood, tissue, and other clinical visuals. This data is intended strictly for medical AI research and development purposes. All provided data is handled responsibly, ensuring patient privacy, confidentiality, and compliance with relevant medical data protection guidelines.

Objectives
1.Detect and localize kidney stones in video frames.
2.Distinguish stones from surrounding tissue, instruments, bubbles, debris, blood, and background anatomy.
3.Estimate the approximate size of detected stones.
4.Assess whether the laser appears safely aligned with the stone before firing.
5.Provide result/inference on the videos from the test video folder available on GitHub.
6.Provide annotated images (pre- and post-processing) on GitHub.

Laser Alignment Classification
The system classifies video segments with laser presence into one of three categories:
Class	Description
Safe to shoot	The laser appears aligned with the stone.
Not safe to shoot	The laser appears aimed away from the stone or toward tissue.
Uncertain	Visibility is poor, the laser is unclear, or model confidence is low.

Deliverable
A working prototype demonstrating the highest level of capability achieved, whether that is:
•Stone detection alone,
•Detection with size estimation, or
•A full system including laser alignment safety classification.

Approach
7.Preprocessing — frame extraction, denoising, handling motion blur, lighting normalization, and irrigation/bubble artifact suppression.
8.Stone Detection & Localization — object detection model trained to identify kidney stones amid tissue, instruments, blood, and debris.
9.Size Estimation — approximate stone size calculated from detected bounding box/segmentation mask, calibrated against scope reference scale where available.
10.Laser Alignment Safety Classification — a classifier that evaluates laser position relative to the detected stone and outputs Safe to shoot, Not safe to shoot, or Uncertain.
11.Inference Pipeline — runs end-to-end on the test video folder, producing annotated output videos and frame-level results.

