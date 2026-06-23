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

Dataset
Dataset provided by ethosh: Computer Vision Dataset (link provided by organizers).
⚠️ Due to the sensitive/NSFW nature of the medical content, the dataset is not redistributed in this repository. Please request access through the official ethosh Ignite channel.
Repository Structure
.
├── data/
│   ├── train/                # Training images/videos
│   ├── test_videos/          # Test videos used for inference
│   └── annotations/          # Pre- and post-processing annotated images
├── notebooks/                # Exploration & experimentation notebooks
├── src/
│   ├── detection/             # Stone detection & localization
│   ├── size_estimation/       # Stone size estimation logic
│   ├── laser_alignment/       # Safe / Not safe / Uncertain classifier
│   └── utils/                 # Preprocessing, visualization helpers
├── results/
│   ├── inference_videos/      # Output videos with overlays
│   └── annotated_images/      # Annotated detection outputs
├── requirements.txt
└── README.md
Approach
7.Preprocessing — frame extraction, denoising, handling motion blur, lighting normalization, and irrigation/bubble artifact suppression.
8.Stone Detection & Localization — object detection model trained to identify kidney stones amid tissue, instruments, blood, and debris.
9.Size Estimation — approximate stone size calculated from detected bounding box/segmentation mask, calibrated against scope reference scale where available.
10.Laser Alignment Safety Classification — a classifier that evaluates laser position relative to the detected stone and outputs Safe to shoot, Not safe to shoot, or Uncertain.
11.Inference Pipeline — runs end-to-end on the test video folder, producing annotated output videos and frame-level results.

Setup
git clone <repo-url>
cd <repo-name>
pip install -r requirements.txt
Usage
# Run inference on test videos
python src/inference.py --input data/test_videos/ --output results/inference_videos/

# Generate annotated images (pre/post processing)
python src/annotate.py --input data/test_videos/ --output results/annotated_images/
Results
•Inference outputs on test videos: results/inference_videos/
•Annotated images (pre & post processing): results/annotated_images/

Ethical & Privacy Notes
•All data must be handled in compliance with patient privacy and medical data protection guidelines.
•This project is intended for research and development purposes only and is not a certified medical device or diagnostic tool.
•No data should be used or shared outside the scope of this hackathon/research effort.

Team
Add team member names here.
Acknowledgements
Problem statement provided by Ethosh Designs Pvt. Ltd. as part of ethosh Ignite 2026.
